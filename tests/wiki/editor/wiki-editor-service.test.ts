import * as path from 'path';
import * as fs from 'fs';
import { WikiEditorService } from '../../../src/wiki/editor/wiki-editor-service';

describe('WikiEditorService', () => {
  let service: WikiEditorService;
  let testProjectPath: string;

  beforeEach(() => {
    testProjectPath = path.join(__dirname, 'test-editor-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    service = new WikiEditorService(testProjectPath);
  });

  afterEach(async () => {
    // Clean up any running timers
    const sessions = await service.getActiveSessions();
    for (const s of sessions) {
      await service.endSession(s.id);
    }
    
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('createSession', () => {
    it('should create a new edit session', async () => {
      const session = await service.createSession('page-1', '# Initial Content');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.pageId).toBe('page-1');
      expect(session.originalContent).toBe('# Initial Content');
      expect(session.currentContent).toBe('# Initial Content');
      expect(session.status).toBe('active');
      expect(session.metadata.cursorPosition).toEqual({ line: 1, column: 1 });
    });

    it('should emit session-created event', async () => {
      const spy = jest.fn();
      service.on('session-created', spy);

      await service.createSession('page-1', 'Content');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].pageId).toBe('page-1');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await service.createSession('page-1', 'Content 1');
      const session2 = await service.createSession('page-2', 'Content 2');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('updateSession', () => {
    it('should update session content', async () => {
      const session = await service.createSession('page-1', 'Initial');
      
      await service.updateSession(session.id, 'Updated Content');

      const updated = await service.getSession(session.id);
      expect(updated?.currentContent).toBe('Updated Content');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(session.createdAt.getTime());
    });

    it('should emit session-updated event', async () => {
      const session = await service.createSession('page-1', 'Initial');
      
      const spy = jest.fn();
      service.on('session-updated', spy);

      await service.updateSession(session.id, 'Updated');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].sessionId).toBe(session.id);
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.updateSession('non-existent', 'Content')).rejects.toThrow('Session not found');
    });

    it('should track undo stack on content change', async () => {
      const session = await service.createSession('page-1', 'Initial');
      
      await service.updateSession(session.id, 'Updated');

      const updated = await service.getSession(session.id);
      expect(updated?.metadata.undoStack.length).toBe(1);
    });

    it('should clear redo stack on new edit', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Update 1');
      
      // Simulate redo stack having items
      const s = await service.getSession(session.id);
      if (s) {
        s.metadata.redoStack.push({ type: 'insert', position: { line: 1, column: 1 }, content: '', timestamp: new Date() });
        
        await service.updateSession(session.id, 'Update 2');
        
        const updated = await service.getSession(session.id);
        expect(updated?.metadata.redoStack.length).toBe(0);
      }
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      const created = await service.createSession('page-1', 'Content');
      
      const retrieved = await service.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await service.getSession('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('endSession', () => {
    it('should end a session', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      await service.endSession(session.id);

      const retrieved = await service.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should emit session-ended event', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const spy = jest.fn();
      service.on('session-ended', spy);

      await service.endSession(session.id);

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].pageId).toBe('page-1');
    });

    it('should disable auto-save when ending session', async () => {
      const session = await service.createSession('page-1', 'Content');
      service.enableAutoSave(session.id, { enabled: true, intervalMs: 1000, maxDrafts: 5 });
      
      const spy = jest.fn();
      service.on('autosave-disabled', spy);

      await service.endSession(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle ending non-existent session gracefully', async () => {
      await expect(service.endSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      await service.createSession('page-1', 'Content 1');
      await service.createSession('page-2', 'Content 2');
      
      const sessions = await service.getActiveSessions();

      expect(sessions.length).toBe(2);
    });

    it('should not include closed sessions', async () => {
      const session = await service.createSession('page-1', 'Content');
      await service.endSession(session.id);
      
      const sessions = await service.getActiveSessions();

      expect(sessions.length).toBe(0);
    });
  });

  describe('enableAutoSave', () => {
    it('should enable auto-save', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      service.enableAutoSave(session.id, { enabled: true, intervalMs: 1000, maxDrafts: 5 });

      const spy = jest.fn();
      service.on('autosave-enabled', spy);
      
      // Re-enable to trigger event
      service.enableAutoSave(session.id, { enabled: true, intervalMs: 1000, maxDrafts: 5 });
      
      expect(spy).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      expect(() => {
        service.enableAutoSave('non-existent', { enabled: true, intervalMs: 1000, maxDrafts: 5 });
      }).toThrow('Session not found');
    });
  });

  describe('disableAutoSave', () => {
    it('should disable auto-save', async () => {
      const session = await service.createSession('page-1', 'Content');
      service.enableAutoSave(session.id, { enabled: true, intervalMs: 1000, maxDrafts: 5 });
      
      const spy = jest.fn();
      service.on('autosave-disabled', spy);

      service.disableAutoSave(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle disabling when not enabled', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      expect(() => {
        service.disableAutoSave(session.id);
      }).not.toThrow();
    });
  });

  describe('saveDraft', () => {
    it('should save a draft', async () => {
      const session = await service.createSession('page-1', '# Draft Content');
      
      const draft = await service.saveDraft(session.id);

      expect(draft).toBeDefined();
      expect(draft.pageId).toBe('page-1');
      expect(draft.content).toBe('# Draft Content');
      expect(draft.metadata.wordCount).toBeGreaterThan(0);
      expect(draft.metadata.characterCount).toBeGreaterThan(0);
    });

    it('should emit draft-saved event', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const spy = jest.fn();
      service.on('draft-saved', spy);

      await service.saveDraft(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.saveDraft('non-existent')).rejects.toThrow('Session not found');
    });

    it('should save draft to file', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const draft = await service.saveDraft(session.id);

      const draftPath = path.join(testProjectPath, '.wiki', 'drafts', `${draft.id}.json`);
      expect(fs.existsSync(draftPath)).toBe(true);
    });
  });

  describe('restoreDraft', () => {
    it('should restore the latest draft', async () => {
      const session = await service.createSession('page-1', 'Content 1');
      await service.saveDraft(session.id);
      
      await service.updateSession(session.id, 'Content 2');
      await service.saveDraft(session.id);

      const draft = await service.restoreDraft('page-1');

      expect(draft).toBeDefined();
      expect(draft?.content).toBe('Content 2');
    });

    it('should return null when no drafts exist', async () => {
      const result = await service.restoreDraft('page-1');
      expect(result).toBeNull();
    });
  });

  describe('getDrafts', () => {
    it('should return all drafts for a page', async () => {
      const session = await service.createSession('page-1', 'Content');
      await service.saveDraft(session.id);
      await service.saveDraft(session.id);

      const drafts = await service.getDrafts('page-1');

      expect(drafts.length).toBe(2);
    });

    it('should return empty array when no drafts', async () => {
      const drafts = await service.getDrafts('page-1');
      expect(drafts).toEqual([]);
    });
  });

  describe('clearDrafts', () => {
    it('should clear all drafts for a page', async () => {
      const session = await service.createSession('page-1', 'Content');
      await service.saveDraft(session.id);
      
      await service.clearDrafts('page-1');

      const drafts = await service.getDrafts('page-1');
      expect(drafts.length).toBe(0);
    });

    it('should emit drafts-cleared event', async () => {
      const session = await service.createSession('page-1', 'Content');
      await service.saveDraft(session.id);
      
      const spy = jest.fn();
      service.on('drafts-cleared', spy);

      await service.clearDrafts('page-1');

      expect(spy).toHaveBeenCalled();
    });

    it('should delete draft files', async () => {
      const session = await service.createSession('page-1', 'Content');
      const draft = await service.saveDraft(session.id);
      
      const draftPath = path.join(testProjectPath, '.wiki', 'drafts', `${draft.id}.json`);
      expect(fs.existsSync(draftPath)).toBe(true);

      await service.clearDrafts('page-1');

      expect(fs.existsSync(draftPath)).toBe(false);
    });
  });

  describe('updateCursorPosition', () => {
    it('should update cursor position', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      service.updateCursorPosition(session.id, { line: 5, column: 10 });

      const updated = await service.getSession(session.id);
      expect(updated?.metadata.cursorPosition).toEqual({ line: 5, column: 10 });
    });

    it('should handle non-existent session gracefully', async () => {
      expect(() => {
        service.updateCursorPosition('non-existent', { line: 1, column: 1 });
      }).not.toThrow();
    });
  });

  describe('updateScrollPosition', () => {
    it('should update scroll position', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      service.updateScrollPosition(session.id, 100);

      const updated = await service.getSession(session.id);
      expect(updated?.metadata.scrollPosition).toBe(100);
    });
  });

  describe('undo', () => {
    it('should undo last edit', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');

      const content = service.undo(session.id);

      expect(content).toBe('Initial');
    });

    it('should emit undo event', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');
      
      const spy = jest.fn();
      service.on('undo', spy);

      service.undo(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should return null when no undo available', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const content = service.undo(session.id);

      expect(content).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      const content = service.undo('non-existent');
      expect(content).toBeNull();
    });
  });

  describe('redo', () => {
    it('should redo last undone edit', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');
      service.undo(session.id);

      const content = service.redo(session.id);

      expect(content).toBe('Updated');
    });

    it('should emit redo event', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');
      service.undo(session.id);
      
      const spy = jest.fn();
      service.on('redo', spy);

      service.redo(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should return null when no redo available', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const content = service.redo(session.id);

      expect(content).toBeNull();
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return true when content changed', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');

      const hasChanges = service.hasUnsavedChanges(session.id);

      expect(hasChanges).toBe(true);
    });

    it('should return false when content unchanged', async () => {
      const session = await service.createSession('page-1', 'Content');

      const hasChanges = service.hasUnsavedChanges(session.id);

      expect(hasChanges).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const hasChanges = service.hasUnsavedChanges('non-existent');
      expect(hasChanges).toBe(false);
    });
  });

  describe('markAsSaved', () => {
    it('should mark session as saved', async () => {
      const session = await service.createSession('page-1', 'Initial');
      await service.updateSession(session.id, 'Updated');

      service.markAsSaved(session.id);

      const hasChanges = service.hasUnsavedChanges(session.id);
      expect(hasChanges).toBe(false);
    });

    it('should emit session-saved event', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      const spy = jest.fn();
      service.on('session-saved', spy);

      service.markAsSaved(session.id);

      expect(spy).toHaveBeenCalled();
    });

    it('should update session status', async () => {
      const session = await service.createSession('page-1', 'Content');
      
      service.markAsSaved(session.id);

      const updated = await service.getSession(session.id);
      expect(updated?.status).toBe('saved');
    });
  });
});
