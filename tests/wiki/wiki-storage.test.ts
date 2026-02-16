import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { WikiStorage } from '../../src/wiki/wiki-storage';
import { WikiDocument, WikiPage } from '../../src/wiki/types';
import { DocumentFormat, Language } from '../../src/types';

function createTestPage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    id: 'test-page',
    title: 'Test Page',
    slug: 'test-page',
    content: '# Test\n\nThis is test content.',
    format: DocumentFormat.Markdown,
    metadata: {
      tags: ['test'],
      category: 'overview',
      sourceFiles: [],
      language: Language.TypeScript,
    },
    sections: [],
    links: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function createTestDocument(pages: WikiPage[] = []): WikiDocument {
  return {
    id: 'test-doc',
    name: 'Test Document',
    description: 'Test description',
    pages,
    index: {
      pages: [],
      categories: [],
      searchIndex: [],
    },
    metadata: {
      projectName: 'Test',
      generator: 'tsd-generator',
      generatorVersion: '1.0.0',
      totalFiles: 0,
      totalSymbols: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('WikiStorage', () => {
  let storage: WikiStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-storage-test-'));
    storage = new WikiStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('save and load', () => {
    it('should save a document', async () => {
      const doc = createTestDocument([createTestPage()]);
      await storage.save(doc);

      const exists = await storage.exists();
      expect(exists).toBe(true);
    });

    it('should load a saved document', async () => {
      const doc = createTestDocument([createTestPage({ id: 'page-1', title: 'Page One' })]);
      await storage.save(doc);

      const loaded = await storage.load(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('Test Document');
      expect(loaded?.description).toBe('Test description');
    });

    it('should return null when document does not exist', async () => {
      const loaded = await storage.load(tempDir);
      expect(loaded).toBeNull();
    });

    it('should return false for exists when storage does not exist', async () => {
      const exists = await storage.exists();
      expect(exists).toBe(false);
    });

    it('should save and load pages', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'Page One', slug: 'page-one' }),
        createTestPage({ id: 'page-2', title: 'Page Two', slug: 'page-two' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const loaded = await storage.load(tempDir);
      expect(loaded?.pages.length).toBe(2);
    });
  });

  describe('savePage and loadPage', () => {
    it('should save a single page', async () => {
      const page = createTestPage({ id: 'single-page' });
      await storage.savePage(page);

      const loaded = await storage.loadPage('single-page');
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Test Page');
    });

    it('should return null for non-existent page', async () => {
      const loaded = await storage.loadPage('non-existent');
      expect(loaded).toBeNull();
    });

    it('should delete a page', async () => {
      const page = createTestPage({ id: 'delete-me' });
      await storage.savePage(page);

      await storage.deletePage('delete-me');

      const loaded = await storage.loadPage('delete-me');
      expect(loaded).toBeNull();
    });

    it('should handle deleting non-existent page', async () => {
      await expect(storage.deletePage('non-existent')).resolves.not.toThrow();
    });
  });

  describe('listPages', () => {
    it('should list all pages', async () => {
      const pages = [
        createTestPage({ id: 'alpha', title: 'Alpha' }),
        createTestPage({ id: 'beta', title: 'Beta' }),
        createTestPage({ id: 'gamma', title: 'Gamma' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const listed = await storage.listPages();
      expect(listed.length).toBe(3);
      expect(listed[0].title).toBe('Alpha');
      expect(listed[1].title).toBe('Beta');
      expect(listed[2].title).toBe('Gamma');
    });

    it('should return empty array when no pages exist', async () => {
      const listed = await storage.listPages();
      expect(listed).toEqual([]);
    });
  });

  describe('getPageBySlug', () => {
    it('should find page by slug', async () => {
      const pages = [
        createTestPage({ id: 'page-1', slug: 'my-page' }),
        createTestPage({ id: 'page-2', slug: 'other-page' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const found = await storage.getPageBySlug('my-page');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('page-1');
    });

    it('should return null for non-existent slug', async () => {
      const found = await storage.getPageBySlug('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getPagesByCategory', () => {
    it('should filter pages by category', async () => {
      const pages = [
        createTestPage({ id: 'page-1', metadata: { tags: [], category: 'api', sourceFiles: [], language: Language.TypeScript } }),
        createTestPage({ id: 'page-2', metadata: { tags: [], category: 'guide', sourceFiles: [], language: Language.TypeScript } }),
        createTestPage({ id: 'page-3', metadata: { tags: [], category: 'api', sourceFiles: [], language: Language.TypeScript } }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const apiPages = await storage.getPagesByCategory('api');
      expect(apiPages.length).toBe(2);
    });
  });

  describe('getPagesByTag', () => {
    it('should filter pages by tag', async () => {
      const pages = [
        createTestPage({ id: 'page-1', metadata: { tags: ['important', 'core'], category: 'overview', sourceFiles: [], language: Language.TypeScript } }),
        createTestPage({ id: 'page-2', metadata: { tags: ['optional'], category: 'overview', sourceFiles: [], language: Language.TypeScript } }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const importantPages = await storage.getPagesByTag('important');
      expect(importantPages.length).toBe(1);
      expect(importantPages[0].id).toBe('page-1');
    });
  });

  describe('searchPages', () => {
    it('should search pages by title', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'API Reference' }),
        createTestPage({ id: 'page-2', title: 'Getting Started' }),
        createTestPage({ id: 'page-3', title: 'API Examples' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const results = await storage.searchPages('api');
      expect(results.length).toBe(2);
    });

    it('should search pages by content', async () => {
      const pages = [
        createTestPage({ id: 'page-1', content: 'This is about authentication.' }),
        createTestPage({ id: 'page-2', content: 'This is about authorization.' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const results = await storage.searchPages('authentication');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('page-1');
    });

    it('should search pages by tag', async () => {
      const pages = [
        createTestPage({ id: 'page-1', metadata: { tags: ['beginner', 'tutorial'], category: 'guide', sourceFiles: [], language: Language.TypeScript } }),
        createTestPage({ id: 'page-2', metadata: { tags: ['advanced'], category: 'guide', sourceFiles: [], language: Language.TypeScript } }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const results = await storage.searchPages('beginner');
      expect(results.length).toBe(1);
    });

    it('should be case-insensitive', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'TypeScript Guide' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const results = await storage.searchPages('TYPESCRIPT');
      expect(results.length).toBe(1);
    });
  });

  describe('exportToMarkdown', () => {
    it('should export pages to markdown files', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'Page One', slug: 'page-one' }),
        createTestPage({ id: 'page-2', title: 'Page Two', slug: 'page-two' }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const outputDir = path.join(tempDir, 'markdown-output');
      const exportedFiles = await storage.exportToMarkdown(outputDir);

      expect(exportedFiles.length).toBe(3);
      expect(exportedFiles.some((f) => f.endsWith('page-one.md'))).toBe(true);
      expect(exportedFiles.some((f) => f.endsWith('page-two.md'))).toBe(true);
      expect(exportedFiles.some((f) => f.endsWith('index.md'))).toBe(true);
    });

    it('should include tags in exported markdown', async () => {
      const pages = [
        createTestPage({
          id: 'page-1',
          slug: 'tagged-page',
          metadata: { tags: ['important', 'core'], category: 'guide', sourceFiles: [], language: Language.TypeScript },
        }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const outputDir = path.join(tempDir, 'markdown-output');
      await storage.exportToMarkdown(outputDir);

      const content = await fs.readFile(path.join(outputDir, 'tagged-page.md'), 'utf-8');
      expect(content).toContain('**Tags:** important, core');
    });

    it('should include links in exported markdown', async () => {
      const pages = [
        createTestPage({
          id: 'page-1',
          slug: 'linked-page',
          links: [
            { text: 'Related Page', target: 'related', type: 'internal' },
            { text: 'External Link', target: 'https://example.com', type: 'external' },
          ],
        }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const outputDir = path.join(tempDir, 'markdown-output');
      await storage.exportToMarkdown(outputDir);

      const content = await fs.readFile(path.join(outputDir, 'linked-page.md'), 'utf-8');
      expect(content).toContain('[Related Page](related.md)');
      expect(content).toContain('[External Link](https://example.com)');
    });

    it('should create index with categories', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'API One', slug: 'api-one', metadata: { tags: [], category: 'api', sourceFiles: [], language: Language.TypeScript } }),
        createTestPage({ id: 'page-2', title: 'Guide One', slug: 'guide-one', metadata: { tags: [], category: 'guide', sourceFiles: [], language: Language.TypeScript } }),
      ];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const outputDir = path.join(tempDir, 'markdown-output');
      await storage.exportToMarkdown(outputDir);

      const indexContent = await fs.readFile(path.join(outputDir, 'index.md'), 'utf-8');
      expect(indexContent).toContain('## Api');
      expect(indexContent).toContain('## Guide');
    });
  });

  describe('exportToGitHubWiki', () => {
    it('should delegate to exportToMarkdown', async () => {
      const pages = [createTestPage({ id: 'page-1', slug: 'test-page' })];
      const doc = createTestDocument(pages);
      await storage.save(doc);

      const outputDir = path.join(tempDir, 'github-wiki');
      const exportedFiles = await storage.exportToGitHubWiki(outputDir);

      expect(exportedFiles.length).toBe(2);
    });
  });
});
