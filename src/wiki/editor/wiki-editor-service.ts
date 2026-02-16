import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  IWikiEditorService,
  WikiEditSession,
  CursorPosition,
  EditAction,
  AutoSaveConfig,
  DraftDocument,
  DEFAULT_EDITOR_CONFIG,
} from './types';

export class WikiEditorService extends EventEmitter implements IWikiEditorService {
  private sessions: Map<string, WikiEditSession> = new Map();
  private drafts: Map<string, DraftDocument[]> = new Map();
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private autoSaveConfigs: Map<string, AutoSaveConfig> = new Map();
  private draftDir: string;

  constructor(projectPath: string) {
    super();
    this.draftDir = path.join(projectPath, '.wiki', 'drafts');
  }

  async createSession(pageId: string, content: string): Promise<WikiEditSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: WikiEditSession = {
      id: sessionId,
      pageId,
      pageTitle: '',
      originalContent: content,
      currentContent: content,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      metadata: {
        cursorPosition: { line: 1, column: 1 },
        scrollPosition: 0,
        undoStack: [],
        redoStack: [],
      },
    };

    this.sessions.set(sessionId, session);
    this.emit('session-created', { sessionId, pageId });

    return session;
  }

  async updateSession(sessionId: string, content: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const previousContent = session.currentContent;
    session.currentContent = content;
    session.updatedAt = new Date();

    if (previousContent !== content) {
      const action = this.createEditAction(
        previousContent,
        content,
        session.metadata.cursorPosition
      );
      session.metadata.undoStack.push(action);
      session.metadata.redoStack = [];
    }

    this.sessions.set(sessionId, session);
    this.emit('session-updated', { sessionId, content });
  }

  async getSession(sessionId: string): Promise<WikiEditSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.disableAutoSave(sessionId);
    session.status = 'closed';
    session.updatedAt = new Date();

    this.sessions.delete(sessionId);
    this.emit('session-ended', { sessionId, pageId: session.pageId });
  }

  async getActiveSessions(): Promise<WikiEditSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  enableAutoSave(sessionId: string, config: AutoSaveConfig): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.disableAutoSave(sessionId);

    this.autoSaveConfigs.set(sessionId, config);

    if (config.enabled) {
      const timer = setInterval(async () => {
        try {
          await this.saveDraft(sessionId);
        } catch (error) {
          this.emit('autosave-error', { sessionId, error });
        }
      }, config.intervalMs);

      this.autoSaveTimers.set(sessionId, timer);
      this.emit('autosave-enabled', { sessionId, interval: config.intervalMs });
    }
  }

  disableAutoSave(sessionId: string): void {
    const timer = this.autoSaveTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(sessionId);
      this.emit('autosave-disabled', { sessionId });
    }
    this.autoSaveConfigs.delete(sessionId);
  }

  async saveDraft(sessionId: string): Promise<DraftDocument> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const config = this.autoSaveConfigs.get(sessionId) || DEFAULT_EDITOR_CONFIG.autoSave;

    await this.ensureDraftDirectory();

    const draft: DraftDocument = {
      id: this.generateDraftId(),
      pageId: session.pageId,
      content: session.currentContent,
      savedAt: new Date(),
      metadata: {
        wordCount: this.countWords(session.currentContent),
        characterCount: session.currentContent.length,
        autoSaved: config.enabled,
      },
    };

    let pageDrafts = this.drafts.get(session.pageId) || [];
    pageDrafts.unshift(draft);

    if (pageDrafts.length > config.maxDrafts) {
      pageDrafts = pageDrafts.slice(0, config.maxDrafts);
    }

    this.drafts.set(session.pageId, pageDrafts);

    const draftPath = path.join(this.draftDir, `${draft.id}.json`);
    await fs.writeFile(draftPath, JSON.stringify(draft, null, 2));

    this.emit('draft-saved', { sessionId, draftId: draft.id });

    return draft;
  }

  async restoreDraft(pageId: string): Promise<DraftDocument | null> {
    const pageDrafts = this.drafts.get(pageId);
    if (!pageDrafts || pageDrafts.length === 0) {
      return null;
    }

    return pageDrafts[0];
  }

  async getDrafts(pageId: string): Promise<DraftDocument[]> {
    return this.drafts.get(pageId) || [];
  }

  async clearDrafts(pageId: string): Promise<void> {
    const pageDrafts = this.drafts.get(pageId) || [];

    for (const draft of pageDrafts) {
      const draftPath = path.join(this.draftDir, `${draft.id}.json`);
      try {
        await fs.unlink(draftPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }

    this.drafts.delete(pageId);
    this.emit('drafts-cleared', { pageId });
  }

  updateCursorPosition(sessionId: string, position: CursorPosition): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.cursorPosition = position;
      this.sessions.set(sessionId, session);
    }
  }

  updateScrollPosition(sessionId: string, position: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.scrollPosition = position;
      this.sessions.set(sessionId, session);
    }
  }

  undo(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.metadata.undoStack.length === 0) {
      return null;
    }

    const action = session.metadata.undoStack.pop()!;
    session.metadata.redoStack.push(action);

    session.currentContent = this.applyUndoAction(session.currentContent, action);
    session.updatedAt = new Date();

    this.sessions.set(sessionId, session);
    this.emit('undo', { sessionId, action });

    return session.currentContent;
  }

  redo(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.metadata.redoStack.length === 0) {
      return null;
    }

    const action = session.metadata.redoStack.pop()!;
    session.metadata.undoStack.push(action);

    session.currentContent = this.applyRedoAction(session.currentContent, action);
    session.updatedAt = new Date();

    this.sessions.set(sessionId, session);
    this.emit('redo', { sessionId, action });

    return session.currentContent;
  }

  hasUnsavedChanges(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    return session.currentContent !== session.originalContent;
  }

  markAsSaved(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.originalContent = session.currentContent;
      session.status = 'saved';
      session.updatedAt = new Date();
      this.sessions.set(sessionId, session);
      this.emit('session-saved', { sessionId });
    }
  }

  private generateSessionId(): string {
    return `session-${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateDraftId(): string {
    return `draft-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private async ensureDraftDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.draftDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  private createEditAction(
    previousContent: string,
    newContent: string,
    position: CursorPosition
  ): EditAction {
    const type = newContent.length > previousContent.length ? 'insert' : 'delete';
    return {
      type,
      position,
      content: newContent,
      previousContent,
      timestamp: new Date(),
    };
  }

  private applyUndoAction(content: string, action: EditAction): string {
    if (action.previousContent !== undefined) {
      return action.previousContent;
    }
    return content;
  }

  private applyRedoAction(_content: string, action: EditAction): string {
    return action.content;
  }
}
