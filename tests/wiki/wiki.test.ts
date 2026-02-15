import { WikiStorage } from '../../src/wiki/wiki-storage';
import { WikiKnowledgeBase } from '../../src/wiki/wiki-knowledge-base';
import { WikiPage, WikiDocument, DocumentFormat, Language } from '../../src/wiki/types';
import * as fs from 'fs';
import * as path from 'path';

describe('WikiStorage', () => {
  let storage: WikiStorage;
  const testStoragePath = path.join(__dirname, 'test-wiki');

  beforeEach(() => {
    storage = new WikiStorage(testStoragePath);
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
  });

  describe('save and load', () => {
    it('should save and load a wiki document', async () => {
      const document: WikiDocument = {
        id: 'test-wiki',
        name: 'Test Wiki',
        description: 'A test wiki',
        pages: [],
        index: {
          pages: [],
          categories: [],
          searchIndex: [],
        },
        metadata: {
          projectName: 'Test Project',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 0,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.save(document);
      const loaded = await storage.load(testStoragePath);

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Test Wiki');
    });
  });

  describe('savePage and loadPage', () => {
    it('should save and load a wiki page', async () => {
      const page: WikiPage = {
        id: 'test-page',
        title: 'Test Page',
        slug: 'test-page',
        content: '# Test\n\nThis is a test page.',
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
      };

      await storage.savePage(page);
      const loaded = await storage.loadPage('test-page');

      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe('Test Page');
      expect(loaded?.slug).toBe('test-page');
    });
  });

  describe('listPages', () => {
    it('should list all saved pages', async () => {
      const page1: WikiPage = {
        id: 'page-1',
        title: 'Page 1',
        slug: 'page-1',
        content: 'Content 1',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: [],
          category: 'overview',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      const page2: WikiPage = {
        id: 'page-2',
        title: 'Page 2',
        slug: 'page-2',
        content: 'Content 2',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: [],
          category: 'api',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      await storage.savePage(page1);
      await storage.savePage(page2);

      const pages = await storage.listPages();

      expect(pages.length).toBe(2);
    });
  });

  describe('deletePage', () => {
    it('should delete a page', async () => {
      const page: WikiPage = {
        id: 'to-delete',
        title: 'To Delete',
        slug: 'to-delete',
        content: 'Content',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: [],
          category: 'overview',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      await storage.savePage(page);
      await storage.deletePage('to-delete');

      const loaded = await storage.loadPage('to-delete');
      expect(loaded).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return false for non-existent storage', async () => {
      const exists = await storage.exists();
      expect(exists).toBe(false);
    });

    it('should return true after saving', async () => {
      const document: WikiDocument = {
        id: 'test',
        name: 'Test',
        pages: [],
        index: { pages: [], categories: [], searchIndex: [] },
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

      await storage.save(document);
      const exists = await storage.exists();
      expect(exists).toBe(true);
    });
  });

  describe('searchPages', () => {
    it('should search pages by query', async () => {
      const page: WikiPage = {
        id: 'searchable',
        title: 'Searchable Page',
        slug: 'searchable-page',
        content: 'This page contains searchable content about TypeScript.',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: ['typescript', 'search'],
          category: 'guide',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      await storage.savePage(page);

      const results = await storage.searchPages('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Searchable Page');
    });
  });
});

describe('WikiKnowledgeBase', () => {
  let knowledgeBase: WikiKnowledgeBase;

  beforeEach(() => {
    knowledgeBase = new WikiKnowledgeBase();
  });

  describe('index', () => {
    it('should index a wiki document', async () => {
      const document: WikiDocument = {
        id: 'test-doc',
        name: 'Test Document',
        pages: [
          {
            id: 'page-1',
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
          },
        ],
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

      await knowledgeBase.index(document);

      const results = knowledgeBase.search(['test']);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('should return answer for a question', async () => {
      const document: WikiDocument = {
        id: 'test-doc',
        name: 'Test Document',
        pages: [
          {
            id: 'page-1',
            title: 'Architecture Overview',
            slug: 'architecture-overview',
            content: '# Architecture\n\nThis project uses a layered architecture pattern with controllers, services, and repositories.',
            format: DocumentFormat.Markdown,
            metadata: {
              tags: ['architecture'],
              category: 'architecture',
              sourceFiles: [],
              language: Language.TypeScript,
            },
            sections: [],
            links: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
        ],
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

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('What architecture pattern does this project use?');

      expect(answer).toBeDefined();
      expect(answer.question).toBe('What architecture pattern does this project use?');
      expect(answer.answer).toBeDefined();
      expect(answer.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return no results message for empty index', async () => {
      const answer = await knowledgeBase.query('What is this?');

      expect(answer.answer).toBe('No relevant information found in the wiki.');
      expect(answer.confidence).toBe(0);
    });
  });

  describe('search', () => {
    it('should return matching pages', async () => {
      const document: WikiDocument = {
        id: 'test-doc',
        name: 'Test Document',
        pages: [
          {
            id: 'api-page',
            title: 'API Reference',
            slug: 'api-reference',
            content: '# API\n\nThis page documents the API endpoints.',
            format: DocumentFormat.Markdown,
            metadata: {
              tags: ['api', 'reference'],
              category: 'api',
              sourceFiles: [],
              language: Language.TypeScript,
            },
            sections: [],
            links: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
        ],
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

      await knowledgeBase.index(document);

      const results = knowledgeBase.search(['api']);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('API Reference');
    });
  });

  describe('getContext', () => {
    it('should return context for a topic', async () => {
      const document: WikiDocument = {
        id: 'test-doc',
        name: 'Test Document',
        pages: [
          {
            id: 'context-page',
            title: 'Context Test',
            slug: 'context-test',
            content: '# Context\n\nThis is context information about testing.',
            format: DocumentFormat.Markdown,
            metadata: {
              tags: ['context', 'test'],
              category: 'guide',
              sourceFiles: [],
              language: Language.TypeScript,
            },
            sections: [],
            links: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
        ],
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

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('context');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
    });
  });
});
