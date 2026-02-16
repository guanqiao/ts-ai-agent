import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  PageLock,
  LockStatus,
  EditSession,
  SessionChange,
  LockConfig,
  DEFAULT_LOCK_CONFIG,
  IWikiLock,
  ClientInfo,
} from './types';

export class WikiLockService extends EventEmitter implements IWikiLock {
  private locksPath: string;
  private sessionsPath: string;
  private locks: Map<string, PageLock> = new Map();
  private sessions: Map<string, EditSession> = new Map();
  private pageSessions: Map<string, Set<string>> = new Map();
  private config: LockConfig;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(projectPath: string, config?: Partial<LockConfig>) {
    super();
    this.locksPath = path.join(projectPath, '.wiki', 'locks.json');
    this.sessionsPath = path.join(projectPath, '.wiki', 'sessions.json');
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    await this.loadLocks();
    await this.loadSessions();
  }

  private async loadLocks(): Promise<void> {
    try {
      const data = await fs.readFile(this.locksPath, 'utf-8');
      const locks: PageLock[] = JSON.parse(data);
      const now = new Date();
      for (const lock of locks) {
        lock.lockedAt = new Date(lock.lockedAt);
        lock.expiresAt = new Date(lock.expiresAt);
        if (lock.expiresAt > now) {
          this.locks.set(lock.pageId, lock);
        }
      }
      await this.saveLocks();
    } catch {
      this.locks.clear();
    }
  }

  private async saveLocks(): Promise<void> {
    const dir = path.dirname(this.locksPath);
    await fs.mkdir(dir, { recursive: true });
    const locks = Array.from(this.locks.values());
    await fs.writeFile(this.locksPath, JSON.stringify(locks, null, 2), 'utf-8');
  }

  private async loadSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.sessionsPath, 'utf-8');
      const sessions: EditSession[] = JSON.parse(data);
      for (const session of sessions) {
        session.startedAt = new Date(session.startedAt);
        session.lastActivityAt = new Date(session.lastActivityAt);
        for (const change of session.changes) {
          change.timestamp = new Date(change.timestamp);
        }
        this.sessions.set(session.id, session);
        if (!this.pageSessions.has(session.pageId)) {
          this.pageSessions.set(session.pageId, new Set());
        }
        this.pageSessions.get(session.pageId)!.add(session.id);
      }
    } catch {
      this.sessions.clear();
      this.pageSessions.clear();
    }
  }

  private async saveSessions(): Promise<void> {
    const dir = path.dirname(this.sessionsPath);
    await fs.mkdir(dir, { recursive: true });
    const sessions = Array.from(this.sessions.values());
    await fs.writeFile(this.sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
  }

  async lockPage(
    pageId: string,
    userId: string,
    reason?: string,
    timeoutMs?: number
  ): Promise<PageLock> {
    const existingLock = this.locks.get(pageId);
    if (existingLock) {
      if (existingLock.lockedBy === userId) {
        return this.extendLock(pageId, userId, timeoutMs || this.config.defaultTimeoutMs);
      }
      if (existingLock.expiresAt > new Date()) {
        throw new Error(`Page ${pageId} is already locked by ${existingLock.lockedBy}`);
      }
      this.locks.delete(pageId);
    }

    const timeout = Math.min(timeoutMs || this.config.defaultTimeoutMs, this.config.maxTimeoutMs);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeout);

    const lock: PageLock = {
      id: this.generateId(),
      pageId,
      lockedBy: userId,
      lockedAt: now,
      expiresAt,
      reason,
      sessionId: this.generateId(),
    };

    this.locks.set(pageId, lock);
    await this.saveLocks();

    this.emit('lock-acquired', { pageId, userId, lock });

    return lock;
  }

  async unlockPage(pageId: string, userId: string): Promise<boolean> {
    const lock = this.locks.get(pageId);
    if (!lock) {
      return true;
    }

    if (lock.lockedBy !== userId) {
      const sessions = this.pageSessions.get(pageId);
      if (sessions) {
        for (const sessionId of sessions) {
          const session = this.sessions.get(sessionId);
          if (session && session.userId === userId) {
            break;
          }
        }
      }
      throw new Error(`Cannot unlock page locked by another user: ${lock.lockedBy}`);
    }

    this.locks.delete(pageId);
    await this.saveLocks();

    this.emit('lock-released', { pageId, userId, lock });

    return true;
  }

  async getLockStatus(pageId: string): Promise<LockStatus> {
    const lock = this.locks.get(pageId);

    if (!lock) {
      return {
        isLocked: false,
        canAcquire: true,
      };
    }

    const now = new Date();
    if (lock.expiresAt <= now) {
      this.locks.delete(pageId);
      await this.saveLocks();
      return {
        isLocked: false,
        canAcquire: true,
      };
    }

    return {
      isLocked: true,
      lock,
      canAcquire: false,
      lockedBy: lock.lockedBy,
      lockedAt: lock.lockedAt,
      expiresAt: lock.expiresAt,
    };
  }

  async extendLock(pageId: string, userId: string, additionalMs: number): Promise<PageLock> {
    const lock = this.locks.get(pageId);
    if (!lock) {
      throw new Error(`No lock found for page ${pageId}`);
    }

    if (lock.lockedBy !== userId) {
      throw new Error('Cannot extend lock owned by another user');
    }

    const additional = Math.min(additionalMs, this.config.maxTimeoutMs);
    lock.expiresAt = new Date(lock.expiresAt.getTime() + additional);

    this.locks.set(pageId, lock);
    await this.saveLocks();

    this.emit('lock-extended', { pageId, userId, lock });

    return lock;
  }

  startLockMonitor(): void {
    if (this.monitorInterval) {
      return;
    }

    this.monitorInterval = setInterval(async () => {
      const releasedCount = await this.releaseExpiredLocks();
      if (releasedCount > 0) {
        this.emit('locks-cleaned', { count: releasedCount });
      }
    }, this.config.cleanupIntervalMs);
  }

  stopLockMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  async releaseExpiredLocks(): Promise<number> {
    const now = new Date();
    let releasedCount = 0;

    for (const [pageId, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(pageId);
        releasedCount++;
        this.emit('lock-expired', { pageId, lock });
      }
    }

    if (releasedCount > 0) {
      await this.saveLocks();
    }

    return releasedCount;
  }

  async forceUnlock(pageId: string, adminUserId: string): Promise<boolean> {
    const lock = this.locks.get(pageId);
    if (!lock) {
      return true;
    }

    this.locks.delete(pageId);
    await this.saveLocks();

    this.emit('lock-force-released', {
      pageId,
      adminUserId,
      originalOwner: lock.lockedBy,
    });

    return true;
  }

  async createSession(
    pageId: string,
    userId: string,
    userName: string,
    clientInfo?: ClientInfo
  ): Promise<EditSession> {
    const sessions = this.pageSessions.get(pageId);
    if (sessions && sessions.size >= this.config.maxSessionsPerPage) {
      throw new Error(
        `Maximum number of sessions (${this.config.maxSessionsPerPage}) reached for page ${pageId}`
      );
    }

    const session: EditSession = {
      id: this.generateId(),
      pageId,
      userId,
      userName,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      clientInfo,
      changes: [],
    };

    this.sessions.set(session.id, session);
    if (!this.pageSessions.has(pageId)) {
      this.pageSessions.set(pageId, new Set());
    }
    this.pageSessions.get(pageId)!.add(session.id);

    await this.saveSessions();

    this.emit('session-created', { pageId, userId, session });

    return session;
  }

  async updateSession(
    sessionId: string,
    change: Omit<SessionChange, 'timestamp'>
  ): Promise<EditSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionChange: SessionChange = {
      ...change,
      timestamp: new Date(),
    };

    session.changes.push(sessionChange);
    session.lastActivityAt = new Date();

    this.sessions.set(sessionId, session);
    await this.saveSessions();

    this.emit('session-updated', { sessionId, change: sessionChange });

    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const pageId = session.pageId;
    this.sessions.delete(sessionId);

    const pageSessionSet = this.pageSessions.get(pageId);
    if (pageSessionSet) {
      pageSessionSet.delete(sessionId);
      if (pageSessionSet.size === 0) {
        this.pageSessions.delete(pageId);
      }
    }

    await this.saveSessions();

    this.emit('session-ended', { sessionId, pageId, userId: session.userId });
  }

  async getActiveSessions(pageId: string): Promise<EditSession[]> {
    const sessionIds = this.pageSessions.get(pageId);
    if (!sessionIds) {
      return [];
    }

    const sessions: EditSession[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async getSession(sessionId: string): Promise<EditSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getUserSessions(userId: string): Promise<EditSession[]> {
    const sessions: EditSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  async cleanupInactiveSessions(inactiveThresholdMs: number = 30 * 60 * 1000): Promise<number> {
    const threshold = new Date(Date.now() - inactiveThresholdMs);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivityAt < threshold) {
        await this.endSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  isMonitorRunning(): boolean {
    return this.monitorInterval !== null;
  }

  getConfig(): LockConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<LockConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
