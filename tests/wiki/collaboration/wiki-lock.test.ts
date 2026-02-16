import * as path from 'path';
import * as fs from 'fs';
import { WikiLockService } from '../../../src/wiki/collaboration/wiki-lock';
import { LockConfig } from '../../../src/wiki/collaboration/types';

describe('WikiLockService', () => {
  let service: WikiLockService;
  let testProjectPath: string;
  const defaultConfig: Partial<LockConfig> = {
    defaultTimeoutMs: 1000, // 1 second for testing
    maxTimeoutMs: 5000,
    cleanupIntervalMs: 500,
  };

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-lock-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    service = new WikiLockService(testProjectPath, defaultConfig);
    await service.initialize();
  });

  afterEach(() => {
    service.stopLockMonitor();
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new WikiLockService(testProjectPath);
      await newService.initialize();
      
      expect(newService).toBeDefined();
    });

    it('should load existing locks on init', async () => {
      // Create a lock first
      await service.lockPage('page-1', 'user-1');
      
      // Create new service instance
      const newService = new WikiLockService(testProjectPath, defaultConfig);
      await newService.initialize();

      const status = await newService.getLockStatus('page-1');
      expect(status.isLocked).toBe(true);
    });
  });

  describe('lockPage', () => {
    it('should lock a page', async () => {
      const lock = await service.lockPage('page-1', 'user-1');

      expect(lock).toBeDefined();
      expect(lock.pageId).toBe('page-1');
      expect(lock.lockedBy).toBe('user-1');
      expect(lock.expiresAt).toBeInstanceOf(Date);
    });

    it('should emit lock-acquired event', async () => {
      const lockSpy = jest.fn();
      service.on('lock-acquired', lockSpy);

      await service.lockPage('page-1', 'user-1');

      expect(lockSpy).toHaveBeenCalled();
      expect(lockSpy.mock.calls[0][0].pageId).toBe('page-1');
    });

    it('should throw error when page is already locked by another user', async () => {
      await service.lockPage('page-1', 'user-1');

      await expect(service.lockPage('page-1', 'user-2')).rejects.toThrow('already locked');
    });

    it('should extend existing lock for same user', async () => {
      const lock1 = await service.lockPage('page-1', 'user-1');
      const originalExpiry = lock1.expiresAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const lock2 = await service.lockPage('page-1', 'user-1');

      expect(lock2.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should respect max timeout', async () => {
      const lock = await service.lockPage('page-1', 'user-1', 'reason', 10000);

      const expectedMaxExpiry = Date.now() + defaultConfig.maxTimeoutMs!;
      expect(lock.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should allow lock after expiry', async () => {
      // Lock with very short timeout
      await service.lockPage('page-1', 'user-1', undefined, 100);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be able to lock now
      const lock = await service.lockPage('page-1', 'user-2');
      expect(lock.lockedBy).toBe('user-2');
    });
  });

  describe('unlockPage', () => {
    it('should unlock a page', async () => {
      await service.lockPage('page-1', 'user-1');

      const result = await service.unlockPage('page-1', 'user-1');

      expect(result).toBe(true);

      const status = await service.getLockStatus('page-1');
      expect(status.isLocked).toBe(false);
    });

    it('should emit lock-released event', async () => {
      await service.lockPage('page-1', 'user-1');

      const unlockSpy = jest.fn();
      service.on('lock-released', unlockSpy);

      await service.unlockPage('page-1', 'user-1');

      expect(unlockSpy).toHaveBeenCalled();
    });

    it('should return true when page is not locked', async () => {
      const result = await service.unlockPage('page-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should throw error when unlocking page locked by another user', async () => {
      await service.lockPage('page-1', 'user-1');

      await expect(service.unlockPage('page-1', 'user-2')).rejects.toThrow('Cannot unlock');
    });
  });

  describe('getLockStatus', () => {
    it('should return unlocked status for free page', async () => {
      const status = await service.getLockStatus('page-1');

      expect(status.isLocked).toBe(false);
      expect(status.canAcquire).toBe(true);
    });

    it('should return locked status for locked page', async () => {
      await service.lockPage('page-1', 'user-1');

      const status = await service.getLockStatus('page-1');

      expect(status.isLocked).toBe(true);
      expect(status.canAcquire).toBe(false);
      expect(status.lockedBy).toBe('user-1');
    });

    it('should return expired status for expired lock', async () => {
      await service.lockPage('page-1', 'user-1', undefined, 100);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = await service.getLockStatus('page-1');

      expect(status.isLocked).toBe(false);
      expect(status.canAcquire).toBe(true);
    });
  });

  describe('extendLock', () => {
    it('should extend lock expiry', async () => {
      const lock = await service.lockPage('page-1', 'user-1');
      const originalExpiry = lock.expiresAt.getTime();

      await new Promise(resolve => setTimeout(resolve, 50));

      const extended = await service.extendLock('page-1', 'user-1', 500);

      expect(extended.expiresAt.getTime()).toBeGreaterThan(originalExpiry);
    });

    it('should emit lock-extended event', async () => {
      await service.lockPage('page-1', 'user-1');

      const extendSpy = jest.fn();
      service.on('lock-extended', extendSpy);

      await service.extendLock('page-1', 'user-1', 500);

      expect(extendSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent lock', async () => {
      await expect(service.extendLock('page-1', 'user-1', 500)).rejects.toThrow('No lock found');
    });

    it('should throw error when extending lock owned by another user', async () => {
      await service.lockPage('page-1', 'user-1');

      await expect(service.extendLock('page-1', 'user-2', 500)).rejects.toThrow('Cannot extend');
    });
  });

  describe('lock monitor', () => {
    it('should start and stop monitor', () => {
      service.startLockMonitor();
      expect(service.isMonitorRunning()).toBe(true);

      service.stopLockMonitor();
      expect(service.isMonitorRunning()).toBe(false);
    });

    it('should release expired locks', async () => {
      await service.lockPage('page-1', 'user-1', undefined, 100);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      const releasedCount = await service.releaseExpiredLocks();

      expect(releasedCount).toBe(1);

      const status = await service.getLockStatus('page-1');
      expect(status.isLocked).toBe(false);
    });

    it('should emit lock-expired event', async () => {
      await service.lockPage('page-1', 'user-1', undefined, 100);

      const expiredSpy = jest.fn();
      service.on('lock-expired', expiredSpy);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      await service.releaseExpiredLocks();

      expect(expiredSpy).toHaveBeenCalled();
    });
  });

  describe('forceUnlock', () => {
    it('should force unlock a page', async () => {
      await service.lockPage('page-1', 'user-1');

      const result = await service.forceUnlock('page-1', 'admin-1');

      expect(result).toBe(true);

      const status = await service.getLockStatus('page-1');
      expect(status.isLocked).toBe(false);
    });

    it('should emit lock-force-released event', async () => {
      await service.lockPage('page-1', 'user-1');

      const forceSpy = jest.fn();
      service.on('lock-force-released', forceSpy);

      await service.forceUnlock('page-1', 'admin-1');

      expect(forceSpy).toHaveBeenCalled();
      expect(forceSpy.mock.calls[0][0].originalOwner).toBe('user-1');
    });

    it('should return true when page is not locked', async () => {
      const result = await service.forceUnlock('page-1', 'admin-1');
      expect(result).toBe(true);
    });
  });

  describe('createSession', () => {
    it('should create an edit session', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      expect(session).toBeDefined();
      expect(session.pageId).toBe('page-1');
      expect(session.userId).toBe('user-1');
      expect(session.userName).toBe('User One');
      expect(session.changes).toEqual([]);
    });

    it('should emit session-created event', async () => {
      const sessionSpy = jest.fn();
      service.on('session-created', sessionSpy);

      await service.createSession('page-1', 'user-1', 'User One');

      expect(sessionSpy).toHaveBeenCalled();
    });

    it('should enforce max sessions per page limit', async () => {
      const config: Partial<LockConfig> = {
        maxSessionsPerPage: 2,
      };
      const limitedService = new WikiLockService(testProjectPath, config);
      await limitedService.initialize();

      await limitedService.createSession('page-1', 'user-1', 'User One');
      await limitedService.createSession('page-1', 'user-2', 'User Two');

      await expect(
        limitedService.createSession('page-1', 'user-3', 'User Three')
      ).rejects.toThrow('Maximum number of sessions');

      limitedService.stopLockMonitor();
    });
  });

  describe('updateSession', () => {
    it('should update session with changes', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      const updated = await service.updateSession(session.id, {
        type: 'content',
        description: 'Added paragraph',
      });

      expect(updated.changes.length).toBe(1);
      expect(updated.changes[0].type).toBe('content');
      expect(updated.changes[0].description).toBe('Added paragraph');
    });

    it('should emit session-updated event', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      const updateSpy = jest.fn();
      service.on('session-updated', updateSpy);

      await service.updateSession(session.id, {
        type: 'content',
        description: 'Updated',
      });

      expect(updateSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        service.updateSession('non-existent', {
          type: 'content',
          description: 'Update',
        })
      ).rejects.toThrow(/Session.*not found/);
    });

    it('should update lastActivityAt on change', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');
      const originalActivity = session.lastActivityAt;

      await new Promise(resolve => setTimeout(resolve, 50));

      const updated = await service.updateSession(session.id, {
        type: 'content',
        description: 'Update',
      });

      expect(updated.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime());
    });
  });

  describe('endSession', () => {
    it('should end a session', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      await service.endSession(session.id);

      const retrieved = await service.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should emit session-ended event', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      const endSpy = jest.fn();
      service.on('session-ended', endSpy);

      await service.endSession(session.id);

      expect(endSpy).toHaveBeenCalled();
    });

    it('should handle ending non-existent session gracefully', async () => {
      await expect(service.endSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for a page', async () => {
      await service.createSession('page-1', 'user-1', 'User One');
      await service.createSession('page-1', 'user-2', 'User Two');
      await service.createSession('page-2', 'user-3', 'User Three');

      const sessions = await service.getActiveSessions('page-1');

      expect(sessions.length).toBe(2);
    });

    it('should return empty array for page with no sessions', async () => {
      const sessions = await service.getActiveSessions('page-1');
      expect(sessions).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should get session by id', async () => {
      const created = await service.createSession('page-1', 'user-1', 'User One');

      const retrieved = await service.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await service.getSession('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('should return all sessions for a user', async () => {
      await service.createSession('page-1', 'user-1', 'User One');
      await service.createSession('page-2', 'user-1', 'User One');
      await service.createSession('page-3', 'user-2', 'User Two');

      const sessions = await service.getUserSessions('user-1');

      expect(sessions.length).toBe(2);
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await service.getUserSessions('user-1');
      expect(sessions).toEqual([]);
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('should cleanup inactive sessions', async () => {
      const session = await service.createSession('page-1', 'user-1', 'User One');

      // Manually set last activity to be old
      const oldDate = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      (session as any).lastActivityAt = oldDate;
      (service as any).sessions.set(session.id, session);

      const cleaned = await service.cleanupInactiveSessions(30 * 60 * 1000);

      expect(cleaned).toBe(1);

      const retrieved = await service.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = service.getConfig();

      expect(config.defaultTimeoutMs).toBe(defaultConfig.defaultTimeoutMs);
      expect(config.maxTimeoutMs).toBe(defaultConfig.maxTimeoutMs);
    });

    it('should update config', () => {
      service.updateConfig({ defaultTimeoutMs: 2000 });

      const config = service.getConfig();
      expect(config.defaultTimeoutMs).toBe(2000);
    });
  });
});
