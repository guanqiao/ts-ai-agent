import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { WikiEditorService } from '../../src/wiki/editor/wiki-editor-service';
import { WikiPreview } from '../../src/wiki/editor/wiki-preview';
import { WikiTemplates } from '../../src/wiki/editor/wiki-templates';
import { DEFAULT_EDITOR_CONFIG } from '../../src/wiki/editor/types';

describe('WikiEditorService', () => {
  let editorService: WikiEditorService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-editor-test-'));
    editorService = new WikiEditorService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('should create a new edit session', async () => {
      const session = await editorService.createSession('page-1', 'Initial content');

      expect(session).toBeDefined();
      expect(session.pageId).toBe('page-1');
      expect(session.originalContent).toBe('Initial content');
      expect(session.currentContent).toBe('Initial content');
      expect(session.status).toBe('active');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await editorService.createSession('page-1', 'Content 1');
      const session2 = await editorService.createSession('page-2', 'Content 2');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('updateSession', () => {
    it('should update session content', async () => {
      const session = await editorService.createSession('page-1', 'Initial content');
      await editorService.updateSession(session.id, 'Updated content');

      const updatedSession = await editorService.getSession(session.id);
      expect(updatedSession?.currentContent).toBe('Updated content');
    });

    it('should track changes in undo stack', async () => {
      const session = await editorService.createSession('page-1', 'Initial content');
      await editorService.updateSession(session.id, 'Updated content');

      const updatedSession = await editorService.getSession(session.id);
      expect(updatedSession?.metadata.undoStack.length).toBe(1);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      const session = await editorService.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should return existing session', async () => {
      const created = await editorService.createSession('page-1', 'Content');
      const retrieved = await editorService.getSession(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe('endSession', () => {
    it('should end an active session', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      await editorService.endSession(session.id);

      const endedSession = await editorService.getSession(session.id);
      expect(endedSession).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      await editorService.createSession('page-1', 'Content 1');
      await editorService.createSession('page-2', 'Content 2');

      const activeSessions = await editorService.getActiveSessions();
      expect(activeSessions.length).toBe(2);
    });
  });

  describe('autoSave', () => {
    it('should enable auto-save for a session', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      editorService.enableAutoSave(session.id, DEFAULT_EDITOR_CONFIG.autoSave);

      expect(() => editorService.disableAutoSave(session.id)).not.toThrow();
    });

    it('should save draft manually', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      const draft = await editorService.saveDraft(session.id);

      expect(draft).toBeDefined();
      expect(draft.pageId).toBe('page-1');
      expect(draft.content).toBe('Content');
    });
  });

  describe('drafts', () => {
    it('should restore the latest draft', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      await editorService.saveDraft(session.id);

      const restored = await editorService.restoreDraft('page-1');
      expect(restored).toBeDefined();
      expect(restored?.content).toBe('Content');
    });

    it('should return null when no draft exists', async () => {
      const restored = await editorService.restoreDraft('non-existent');
      expect(restored).toBeNull();
    });

    it('should clear all drafts for a page', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      await editorService.saveDraft(session.id);
      await editorService.clearDrafts('page-1');

      const drafts = await editorService.getDrafts('page-1');
      expect(drafts.length).toBe(0);
    });
  });

  describe('undo/redo', () => {
    it('should undo the last change', async () => {
      const session = await editorService.createSession('page-1', 'Initial');
      await editorService.updateSession(session.id, 'Updated');

      const undone = editorService.undo(session.id);
      expect(undone).toBe('Initial');
    });

    it('should redo a previously undone change', async () => {
      const session = await editorService.createSession('page-1', 'Initial');
      await editorService.updateSession(session.id, 'Updated');
      editorService.undo(session.id);

      const redone = editorService.redo(session.id);
      expect(redone).toBe('Updated');
    });

    it('should return null when nothing to undo', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      const undone = editorService.undo(session.id);
      expect(undone).toBeNull();
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return false when content matches original', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      expect(editorService.hasUnsavedChanges(session.id)).toBe(false);
    });

    it('should return true when content differs from original', async () => {
      const session = await editorService.createSession('page-1', 'Content');
      await editorService.updateSession(session.id, 'Modified');
      expect(editorService.hasUnsavedChanges(session.id)).toBe(true);
    });
  });
});

describe('WikiPreview', () => {
  let preview: WikiPreview;

  beforeEach(() => {
    preview = new WikiPreview();
  });

  describe('renderPreview', () => {
    it('should convert headings to HTML', async () => {
      const content = '# Title\n## Subtitle';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<h1 id="Title">Title</h1>');
      expect(html).toContain('<h2 id="Subtitle">Subtitle</h2>');
    });

    it('should convert bold and italic text', async () => {
      const content = '**bold** and *italic*';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('should convert inline code', async () => {
      const content = 'Use `code` here';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<code class="inline-code">code</code>');
    });

    it('should convert code blocks', async () => {
      const content = '```typescript\nconst x = 1;\n```';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<pre class="code-block"');
      expect(html).toContain('data-language="typescript"');
    });

    it('should convert links', async () => {
      const content = '[Link](https://example.com)';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<a href="https://example.com"');
      expect(html).toContain('class="wiki-link external"');
    });

    it('should convert images', async () => {
      const content = '![Alt text](image.png)';
      const html = await preview.renderPreview(content);

      expect(html).toContain('<img src="image.png" alt="Alt text"');
    });
  });

  describe('syncScroll', () => {
    it('should track scroll position', () => {
      preview.syncScroll(100);
      expect(preview.getCurrentScrollPosition()).toBe(100);
    });
  });

  describe('highlightSection', () => {
    it('should track highlighted section', () => {
      preview.highlightSection('section-1');
      expect(preview.getHighlightedSection()).toBe('section-1');
    });
  });

  describe('getTableOfContents', () => {
    it('should extract table of contents from rendered content', async () => {
      const content = '# Main\n## Section 1\n## Section 2';
      await preview.renderPreview(content);

      const toc = await preview.getTableOfContents();
      expect(toc.length).toBeGreaterThan(0);
    });
  });
});

describe('WikiTemplates', () => {
  let templates: WikiTemplates;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-templates-test-'));
    templates = new WikiTemplates(tempDir);
    await templates.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getTemplate', () => {
    it('should return null for non-existent template', async () => {
      const template = await templates.getTemplate('non-existent');
      expect(template).toBeNull();
    });

    it('should return built-in API template', async () => {
      const template = await templates.getTemplate('template-api-doc');
      expect(template).toBeDefined();
      expect(template?.name).toBe('API Documentation');
    });
  });

  describe('getTemplates', () => {
    it('should return all templates when no category specified', async () => {
      const allTemplates = await templates.getTemplates();
      expect(allTemplates.length).toBeGreaterThan(0);
    });

    it('should filter templates by category', async () => {
      const apiTemplates = await templates.getTemplates('api');
      expect(apiTemplates.every((t) => t.category === 'api')).toBe(true);
    });
  });

  describe('applyTemplate', () => {
    it('should apply template with variables', async () => {
      const content = await templates.applyTemplate('template-api-doc', {
        name: 'TestAPI',
        description: 'Test description',
        method: 'GET',
        path: '/api/test',
      });

      expect(content).toContain('# TestAPI');
      expect(content).toContain('Test description');
      expect(content).toContain('GET /api/test');
    });

    it('should throw error for missing required variables', async () => {
      await expect(
        templates.applyTemplate('template-api-doc', {})
      ).rejects.toThrow();
    });
  });

  describe('createTemplate', () => {
    it('should create a new custom template', async () => {
      const newTemplate = await templates.createTemplate({
        name: 'Custom Template',
        description: 'A custom template',
        category: 'custom',
        content: '# {{title}}\n\n{{content}}',
        variables: [
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'content', label: 'Content', type: 'text', required: false },
        ],
      });

      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('Custom Template');
    });
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const result = templates.validateTemplate({
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [
          { name: 'title', label: 'Title', type: 'text', required: true },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing required fields', () => {
      const result = templates.validateTemplate({
        id: 'test',
        name: '',
        description: '',
        category: 'custom',
        content: '',
        variables: [],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });
  });
});
