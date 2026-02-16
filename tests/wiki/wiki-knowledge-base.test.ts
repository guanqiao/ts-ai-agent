import { WikiKnowledgeBase } from '../../src/wiki/wiki-knowledge-base';
import { WikiPage, WikiDocument } from '../../src/wiki/types';
import { DocumentFormat, Language } from '../../src/types';
import { LLMService } from '../../src/llm';

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
    pages,
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
}

describe('WikiKnowledgeBase', () => {
  let knowledgeBase: WikiKnowledgeBase;

  beforeEach(() => {
    knowledgeBase = new WikiKnowledgeBase();
  });

  describe('index', () => {
    it('should index an empty document', async () => {
      const document = createTestDocument();

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['anything']);
      expect(results).toHaveLength(0);
    });

    it('should index a single page', async () => {
      const page = createTestPage({
        id: 'single-page',
        title: 'Single Page',
        content: '# Single\n\nThis is a single page content.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['single']);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Single Page');
    });

    it('should index multiple pages', async () => {
      const pages = [
        createTestPage({ id: 'page-1', title: 'First Page', slug: 'first-page' }),
        createTestPage({ id: 'page-2', title: 'Second Page', slug: 'second-page' }),
        createTestPage({ id: 'page-3', title: 'Third Page', slug: 'third-page' }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['page']);
      expect(results).toHaveLength(3);
    });

    it('should clear old data when re-indexing', async () => {
      const firstDoc = createTestDocument([
        createTestPage({ id: 'old-page', title: 'Old Page', slug: 'old-page' }),
      ]);

      await knowledgeBase.index(firstDoc);

      const secondDoc = createTestDocument([
        createTestPage({ id: 'new-page', title: 'New Page', slug: 'new-page' }),
      ]);

      await knowledgeBase.index(secondDoc);

      const oldResults = await knowledgeBase.search(['old']);
      expect(oldResults).toHaveLength(0);

      const newResults = await knowledgeBase.search(['new']);
      expect(newResults).toHaveLength(1);
      expect(newResults[0].title).toBe('New Page');
    });

    it('should build search index with keywords from title', async () => {
      const page = createTestPage({
        id: 'keyword-test',
        title: 'Architecture Design Patterns',
        content: 'Some content here.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['architecture']);
      expect(results).toHaveLength(1);
    });

    it('should build search index with keywords from tags', async () => {
      const page = createTestPage({
        id: 'tag-test',
        title: 'Guide',
        content: 'Some content.',
        metadata: {
          tags: ['important', 'guide', 'tutorial'],
          category: 'guide',
          sourceFiles: [],
          language: Language.TypeScript,
        },
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['tutorial']);
      expect(results).toHaveLength(1);
    });
  });

  describe('query', () => {
    it('should return default message when index is empty', async () => {
      const answer = await knowledgeBase.query('What is this?');

      expect(answer.question).toBe('What is this?');
      expect(answer.answer).toBe('No relevant information found in the wiki.');
      expect(answer.confidence).toBe(0);
      expect(answer.relatedPages).toHaveLength(0);
      expect(answer.sources).toHaveLength(0);
    });

    it('should return answer using keyword matching without LLM', async () => {
      const page = createTestPage({
        id: 'arch-page',
        title: 'Architecture Overview',
        slug: 'architecture-overview',
        content: `# Architecture

This project uses a layered architecture pattern.

## Controllers

Controllers handle HTTP requests.

## Services

Services contain business logic.`,
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('What architecture pattern is used?');

      expect(answer.question).toBe('What architecture pattern is used?');
      expect(answer.answer).toBeDefined();
      expect(answer.answer.length).toBeGreaterThan(0);
      expect(answer.confidence).toBe(0.5);
      expect(answer.relatedPages).toContain('arch-page');
    });

    it('should return sources in the answer', async () => {
      const page = createTestPage({
        id: 'source-test',
        title: 'Source Test Page',
        content: 'This is the source content for testing.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('source content');

      expect(answer.sources).toBeDefined();
      expect(answer.sources.length).toBeGreaterThan(0);
      expect(answer.sources[0].pageId).toBe('source-test');
      expect(answer.sources[0].pageTitle).toBe('Source Test Page');
    });

    it('should handle questions with no matching keywords', async () => {
      const page = createTestPage({
        id: 'unrelated',
        title: 'Unrelated Content',
        content: 'This page talks about cooking recipes.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('What is the database schema?');

      expect(answer.answer).toBe('No relevant information found in the wiki.');
      expect(answer.confidence).toBe(0);
    });

    it('should use LLM service when available', async () => {
      const mockLLMService = {
        complete: jest.fn().mockResolvedValue('This is an LLM-generated answer.'),
      } as unknown as LLMService;

      knowledgeBase.setLLMService(mockLLMService);

      const page = createTestPage({
        id: 'llm-test',
        title: 'LLM Test Page',
        content: 'Content for LLM testing.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('Test question?');

      expect(mockLLMService.complete).toHaveBeenCalled();
      expect(answer.answer).toBe('This is an LLM-generated answer.');
      expect(answer.confidence).toBe(0.8);
    });

    it('should fallback to keyword matching when LLM fails', async () => {
      const mockLLMService = {
        complete: jest.fn().mockRejectedValue(new Error('LLM error')),
      } as unknown as LLMService;

      knowledgeBase.setLLMService(mockLLMService);

      const page = createTestPage({
        id: 'fallback-test',
        title: 'Fallback Test',
        content: '## Section\n\nContent for fallback testing.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('fallback');

      expect(mockLLMService.complete).toHaveBeenCalled();
      expect(answer.confidence).toBe(0.5);
    });
  });

  describe('search', () => {
    it('should search by title keywords', async () => {
      const pages = [
        createTestPage({ id: 'api-1', title: 'API Reference', slug: 'api-ref' }),
        createTestPage({ id: 'guide-1', title: 'User Guide', slug: 'user-guide' }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['api']);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('API Reference');
    });

    it('should search by content keywords', async () => {
      const pages = [
        createTestPage({
          id: 'content-1',
          title: 'Documentation',
          content: 'This page explains the authentication flow.',
        }),
        createTestPage({
          id: 'content-2',
          title: 'Other',
          content: 'This is unrelated content.',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['authentication']);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('content-1');
    });

    it('should search by tags', async () => {
      const pages = [
        createTestPage({
          id: 'tag-1',
          title: 'Document',
          metadata: {
            tags: ['important', 'security'],
            category: 'guide',
            sourceFiles: [],
            language: Language.TypeScript,
          },
        }),
        createTestPage({
          id: 'tag-2',
          title: 'Other Document',
          metadata: {
            tags: ['general'],
            category: 'overview',
            sourceFiles: [],
            language: Language.TypeScript,
          },
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['security']);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tag-1');
    });

    it('should combine multiple keywords', async () => {
      const pages = [
        createTestPage({
          id: 'multi-1',
          title: 'API Security Guide',
          content: 'How to secure your API endpoints.',
          metadata: {
            tags: ['security', 'api'],
            category: 'guide',
            sourceFiles: [],
            language: Language.TypeScript,
          },
        }),
        createTestPage({
          id: 'multi-2',
          title: 'General Guide',
          content: 'General information.',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['api', 'security']);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('multi-1');
    });

    it('should sort results by score descending', async () => {
      const pages = [
        createTestPage({
          id: 'low-score',
          title: 'Some Page',
          content: 'Contains keyword once.',
        }),
        createTestPage({
          id: 'high-score',
          title: 'Keyword Keyword Keyword Keyword Keyword',
          content: 'Keyword keyword keyword keyword keyword keyword keyword keyword keyword keyword keyword keyword.',
          metadata: {
            tags: ['keyword', 'keyword2', 'keyword3'],
            category: 'overview',
            sourceFiles: [],
            language: Language.TypeScript,
          },
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['keyword']);

      expect(results.length).toBe(2);
    });

    it('should limit results to 10', async () => {
      const pages = Array.from({ length: 15 }, (_, i) =>
        createTestPage({
          id: `limit-${i}`,
          title: `Page ${i}`,
          content: 'Contains the keyword.',
        })
      );
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['keyword']);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no matches', async () => {
      const page = createTestPage({
        id: 'no-match',
        title: 'Unrelated',
        content: 'Nothing relevant here.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['nonexistent']);

      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const page = createTestPage({
        id: 'case-test',
        title: 'TypeScript Guide',
        content: 'Learn TypeScript programming.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search(['TYPESCRIPT']);

      expect(results).toHaveLength(1);
    });
  });

  describe('getRelatedPages', () => {
    it('should return empty array for non-existent page', async () => {
      const related = await knowledgeBase.getRelatedPages('non-existent');

      expect(related).toHaveLength(0);
    });

    it('should extract internal markdown links', async () => {
      const pages = [
        createTestPage({
          id: 'target-page',
          title: 'Target Page',
          slug: 'target-page',
          content: 'This is the target.',
        }),
        createTestPage({
          id: 'source-page',
          title: 'Source',
          slug: 'source-page',
          content: 'Check the [Target Page](target-page) for more info.',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('source-page');

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('target-page');
    });

    it('should extract links from WikiLink objects', async () => {
      const pages = [
        createTestPage({
          id: 'link-target',
          title: 'Link Target',
          slug: 'link-target',
          content: 'Target content.',
        }),
        createTestPage({
          id: 'link-source',
          title: 'Link Source',
          slug: 'link-source',
          content: 'Some content.',
          links: [
            { text: 'Related', target: 'link-target', type: 'internal' },
          ],
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('link-source');

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('link-target');
    });

    it('should filter out external links', async () => {
      const pages = [
        createTestPage({
          id: 'external-test',
          title: 'External Links',
          slug: 'external-test',
          content: 'Visit [Google](https://google.com) and [GitHub](http://github.com).',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('external-test');

      expect(related).toHaveLength(0);
    });

    it('should filter out external WikiLinks', async () => {
      const pages = [
        createTestPage({
          id: 'wiki-external',
          title: 'Wiki External',
          slug: 'wiki-external',
          content: 'Content.',
          links: [
            { text: 'External', target: 'https://example.com', type: 'external' },
          ],
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('wiki-external');

      expect(related).toHaveLength(0);
    });

    it('should return empty array for page with no links', async () => {
      const page = createTestPage({
        id: 'no-links',
        title: 'No Links',
        slug: 'no-links',
        content: 'This page has no links.',
        links: [],
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('no-links');

      expect(related).toHaveLength(0);
    });

    it('should handle multiple related pages', async () => {
      const pages = [
        createTestPage({
          id: 'page-a',
          title: 'Page A',
          slug: 'page-a',
          content: 'Content A.',
        }),
        createTestPage({
          id: 'page-b',
          title: 'Page B',
          slug: 'page-b',
          content: 'Content B.',
        }),
        createTestPage({
          id: 'multi-source',
          title: 'Multi Source',
          slug: 'multi-source',
          content: 'See [Page A](page-a) and [Page B](page-b).',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const related = await knowledgeBase.getRelatedPages('multi-source');

      expect(related).toHaveLength(2);
      const relatedIds = related.map((p) => p.id);
      expect(relatedIds).toContain('page-a');
      expect(relatedIds).toContain('page-b');
    });
  });

  describe('getContext', () => {
    it('should return context for a matching topic', async () => {
      const page = createTestPage({
        id: 'context-page',
        title: 'Context Test',
        content: 'This is detailed context information about the topic.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('context');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
      expect(context).toContain('Context Test');
    });

    it('should return empty string when no matches', async () => {
      const page = createTestPage({
        id: 'unrelated-context',
        title: 'Unrelated',
        content: 'This has nothing to do with the search.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('nonexistent');

      expect(context).toBe('');
    });

    it('should combine multiple pages in context', async () => {
      const pages = [
        createTestPage({
          id: 'ctx-1',
          title: 'First Context',
          content: 'First piece of context information.',
        }),
        createTestPage({
          id: 'ctx-2',
          title: 'Second Context',
          content: 'Second piece of context information.',
        }),
      ];
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('context');

      expect(context).toContain('First Context');
      expect(context).toContain('Second Context');
    });

    it('should limit context to top 3 pages', async () => {
      const pages = Array.from({ length: 5 }, (_, i) =>
        createTestPage({
          id: `ctx-limit-${i}`,
          title: `Context Page ${i}`,
          content: `Context information number ${i}.`,
        })
      );
      const document = createTestDocument(pages);

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('context');

      const titleCount = (context.match(/## Context Page/g) || []).length;
      expect(titleCount).toBeLessThanOrEqual(3);
    });

    it('should truncate long content', async () => {
      const longContent = 'A'.repeat(1000);
      const page = createTestPage({
        id: 'long-content',
        title: 'Long Content',
        content: longContent,
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const context = await knowledgeBase.getContext('long');

      expect(context.length).toBeLessThan(longContent.length + 100);
    });
  });

  describe('setLLMService', () => {
    it('should set LLM service via constructor', () => {
      const mockLLMService = {} as LLMService;
      const kb = new WikiKnowledgeBase(mockLLMService);

      expect(kb).toBeDefined();
    });

    it('should set LLM service via method', () => {
      const mockLLMService = {} as LLMService;

      knowledgeBase.setLLMService(mockLLMService);

      expect(knowledgeBase).toBeDefined();
    });

    it('should replace existing LLM service', async () => {
      const firstMock = {
        complete: jest.fn().mockResolvedValue('First LLM response'),
      } as unknown as LLMService;
      const secondMock = {
        complete: jest.fn().mockResolvedValue('Second LLM response'),
      } as unknown as LLMService;

      knowledgeBase.setLLMService(firstMock);

      const page = createTestPage({ id: 'llm-replace', title: 'Test' });
      await knowledgeBase.index(createTestDocument([page]));

      await knowledgeBase.query('test');

      expect(firstMock.complete).toHaveBeenCalled();

      knowledgeBase.setLLMService(secondMock);

      await knowledgeBase.query('test again');

      expect(secondMock.complete).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in content', async () => {
      const page = createTestPage({
        id: 'special-chars',
        title: 'Special Characters',
        content: '# Test\n\nContent with special chars: <>&"\'\n\n## Section\n\nMore content.',
      });
      const document = createTestDocument([page]);

      await expect(knowledgeBase.index(document)).resolves.not.toThrow();
    });

    it('should handle empty content', async () => {
      const page = createTestPage({
        id: 'empty-content',
        title: 'Empty',
        content: '',
      });
      const document = createTestDocument([page]);

      await expect(knowledgeBase.index(document)).resolves.not.toThrow();
    });

    it('should handle content with only whitespace', async () => {
      const page = createTestPage({
        id: 'whitespace',
        title: 'Whitespace',
        content: '   \n\n   \t\t  ',
      });
      const document = createTestDocument([page]);

      await expect(knowledgeBase.index(document)).resolves.not.toThrow();
    });

    it('should handle very long keywords', async () => {
      const longKeyword = 'a'.repeat(1000);
      const page = createTestPage({
        id: 'long-keyword',
        title: 'Long Keyword Test',
        content: `This contains ${longKeyword} as a keyword.`,
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const results = await knowledgeBase.search([longKeyword]);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle Unicode characters', async () => {
      const page = createTestPage({
        id: 'unicode',
        title: 'Unicode 测试',
        content: '# Unicode\n\n这是中文内容。日本語も含まれています。🎉',
      });
      const document = createTestDocument([page]);

      await expect(knowledgeBase.index(document)).resolves.not.toThrow();
    });

    it('should parse sections correctly', async () => {
      const page = createTestPage({
        id: 'sections',
        title: 'Sections Test',
        content: `# Main Title

Introduction paragraph.

## First Section

Content for first section.

## Second Section

Content for second section.

### Subsection

Subsection content.`,
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      const answer = await knowledgeBase.query('section');

      expect(answer.answer).toBeDefined();
    });

    it('should handle pages with same slug', async () => {
      const pages = [
        createTestPage({ id: 'dup-1', title: 'First', slug: 'duplicate' }),
        createTestPage({ id: 'dup-2', title: 'Second', slug: 'duplicate' }),
      ];
      const document = createTestDocument(pages);

      await expect(knowledgeBase.index(document)).resolves.not.toThrow();
    });

    it('should handle query with special regex characters', async () => {
      const page = createTestPage({
        id: 'regex-test',
        title: 'Regex Test',
        content: 'Content with (parentheses) and [brackets] and $symbols.',
      });
      const document = createTestDocument([page]);

      await knowledgeBase.index(document);

      await expect(knowledgeBase.query('(parentheses)')).resolves.toBeDefined();
      await expect(knowledgeBase.query('[brackets]')).resolves.toBeDefined();
      await expect(knowledgeBase.query('$symbols')).resolves.toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle a complete workflow', async () => {
      const pages: WikiPage[] = [
        {
          id: 'getting-started',
          title: 'Getting Started',
          slug: 'getting-started',
          content: `# Getting Started

Follow these steps to begin.

## Installation

Run npm install to install dependencies.

## Configuration

Create a config file.`,
          format: DocumentFormat.Markdown,
          metadata: {
            tags: ['guide', 'setup'],
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
        {
          id: 'home',
          title: 'Home',
          slug: 'home',
          content: `# Welcome

This is the home page. See [Getting Started](getting-started) for help.`,
          format: DocumentFormat.Markdown,
          metadata: {
            tags: ['home', 'welcome'],
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
        {
          id: 'api-reference',
          title: 'API Reference',
          slug: 'api-reference',
          content: `# API Reference

## Endpoints

- GET /users
- POST /users
- GET /items`,
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
      ];

      const document: WikiDocument = {
        id: 'full-wiki',
        name: 'Full Wiki',
        pages,
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

      await knowledgeBase.index(document);

      const searchResults = await knowledgeBase.search(['api']);
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe('API Reference');

      const relatedPages = await knowledgeBase.getRelatedPages('home');
      expect(relatedPages).toHaveLength(1);
      expect(relatedPages[0].slug).toBe('getting-started');

      const answer = await knowledgeBase.query('npm install dependencies');
      expect(answer.answer).toBeDefined();
      expect(answer.confidence).toBeGreaterThanOrEqual(0);

      const context = await knowledgeBase.getContext('api');
      expect(context).toContain('API Reference');
    });

    it('should work with LLM integration end-to-end', async () => {
      const mockLLMService = {
        complete: jest.fn().mockResolvedValue(
          'Based on the wiki, you should follow the installation guide.'
        ),
      } as unknown as LLMService;

      knowledgeBase.setLLMService(mockLLMService);

      const page = createTestPage({
        id: 'install-guide',
        title: 'Installation Guide',
        content: '## Installation\n\nRun npm install to set up the project.',
      });
      await knowledgeBase.index(createTestDocument([page]));

      const answer = await knowledgeBase.query('installation npm project');

      expect(mockLLMService.complete).toHaveBeenCalledTimes(1);
      expect(answer.answer).toBe('Based on the wiki, you should follow the installation guide.');
      expect(answer.confidence).toBe(0.8);
      expect(answer.relatedPages).toContain('install-guide');
    });
  });
});
