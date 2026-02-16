import { NodeExtractor } from '../../../src/wiki/knowledge/node-extractor';
import { WikiPage, WikiCategory } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';

function createTestPage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    id: 'test-page',
    title: 'Test Page',
    slug: 'test-page',
    content: '# Test\n\nThis is test content.',
    format: DocumentFormat.Markdown,
    metadata: {
      tags: ['test'],
      category: 'overview' as WikiCategory,
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

describe('NodeExtractor', () => {
  let extractor: NodeExtractor;

  beforeEach(() => {
    extractor = new NodeExtractor();
  });

  describe('extractConcepts', () => {
    it('should extract concepts from page titles', () => {
      const pages = [
        createTestPage({
          id: 'concept-1',
          title: 'Architecture Overview',
          content: '# Architecture Overview\n\nThis describes the architecture.',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.length).toBeGreaterThan(0);
    });

    it('should extract concepts from headings', () => {
      const pages = [
        createTestPage({
          id: 'heading-test',
          content: '# Main Title\n\n## Authentication\n\n## Authorization\n\n## Caching',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name.toLowerCase().includes('authentication'))).toBe(true);
    });

    it('should extract concepts from bold text', () => {
      const pages = [
        createTestPage({
          id: 'bold-test',
          content: 'This is about **Dependency Injection** and **Service Locator**.',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name.toLowerCase().includes('dependency'))).toBe(true);
    });

    it('should extract concepts from code references', () => {
      const pages = [
        createTestPage({
          id: 'code-test',
          content: 'Use the `UserService` and `Repository` classes.',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name.toLowerCase() === 'userservice')).toBe(true);
    });

    it('should extract concepts from tags', () => {
      const pages = [
        createTestPage({
          id: 'tag-test',
          metadata: {
            tags: ['api', 'rest', 'http'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name.toLowerCase() === 'api')).toBe(true);
    });

    it('should aggregate concepts across multiple pages', () => {
      const pages = [
        createTestPage({ id: 'page-1', content: 'About **Authentication**' }),
        createTestPage({ id: 'page-2', content: 'More about **Authentication**' }),
        createTestPage({ id: 'page-3', content: 'Even more about **Authentication**' }),
      ];

      const concepts = extractor.extractConcepts(pages);

      const authConcept = concepts.find(c => c.name.toLowerCase() === 'authentication');
      expect(authConcept).toBeDefined();
    });

    it('should filter out common words', () => {
      const pages = [
        createTestPage({
          id: 'common-test',
          content: 'The **the** and **and** are common words.',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name.toLowerCase() === 'the')).toBe(false);
    });

    it('should set importance based on frequency', () => {
      const pages = [
        createTestPage({ id: 'freq-1', content: '**ConceptA** mentioned here.' }),
        createTestPage({ id: 'freq-2', content: '**ConceptA** again.' }),
        createTestPage({ id: 'freq-3', content: '**ConceptA** once more.' }),
        createTestPage({ id: 'freq-4', content: '**ConceptB** only once.' }),
      ];

      const concepts = extractor.extractConcepts(pages);

      const conceptA = concepts.find(c => c.name.toLowerCase() === 'concepta');
      const conceptB = concepts.find(c => c.name.toLowerCase() === 'conceptb');

      expect(conceptA!.importance).toBeGreaterThanOrEqual(conceptB!.importance);
    });
  });

  describe('extractAPIs', () => {
    it('should extract class definitions', () => {
      const pages = [
        createTestPage({
          id: 'api-page',
          metadata: {
            tags: ['api'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: `# API
\`\`\`typescript
export class UserService {
  private repository: Repository;
}
\`\`\``,
        }),
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'UserService' && a.type === 'class')).toBe(true);
    });

    it('should extract interface definitions', () => {
      const pages = [
        createTestPage({
          id: 'api-page',
          metadata: {
            tags: ['api'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: `\`\`\`typescript
export interface IUser {
  id: string;
  name: string;
}
\`\`\``,
        }),
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'IUser' && a.type === 'interface')).toBe(true);
    });

    it('should extract function definitions', () => {
      const pages = [
        createTestPage({
          id: 'api-page',
          metadata: {
            tags: ['api'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: `\`\`\`typescript
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}
\`\`\``,
        }),
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'calculateTotal' && a.type === 'function')).toBe(true);
    });

    it('should only extract from API and reference pages', () => {
      const pages = [
        createTestPage({
          id: 'api-page',
          metadata: {
            tags: ['api'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: '```typescript\nexport class ApiClass {}\n```',
        }),
        createTestPage({
          id: 'guide-page',
          metadata: {
            tags: ['guide'],
            category: 'guide' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: '```typescript\nexport class GuideClass {}\n```',
        }),
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'ApiClass')).toBe(true);
      expect(apis.some(a => a.name === 'GuideClass')).toBe(false);
    });
  });

  describe('extractPatterns', () => {
    it('should detect singleton pattern', () => {
      const pages = [
        createTestPage({
          id: 'pattern-page',
          content: `# Singleton Pattern
Use getInstance to get the singleton instance.
The instance is created only once.`,
        }),
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name === 'singleton')).toBe(true);
    });

    it('should detect factory pattern', () => {
      const pages = [
        createTestPage({
          id: 'factory-page',
          content: `# Factory
The factory create method builds new objects.
Use the factory to create instances.`,
        }),
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name === 'factory')).toBe(true);
    });

    it('should detect observer pattern', () => {
      const pages = [
        createTestPage({
          id: 'observer-page',
          content: `# Observer
Subscribe to events and the observer will notify you.
Use emit to send notifications.`,
        }),
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name === 'observer')).toBe(true);
    });

    it('should require multiple keyword matches', () => {
      const pages = [
        createTestPage({
          id: 'weak-pattern',
          content: 'Just mentioning singleton once.',
        }),
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name === 'singleton')).toBe(false);
    });

    it('should aggregate patterns across pages', () => {
      const pages = [
        createTestPage({ id: 'p1', content: 'Use factory to create objects.' }),
        createTestPage({ id: 'p2', content: 'The factory pattern is useful.' }),
      ];

      const patterns = extractor.extractPatterns(pages);

      const factoryPattern = patterns.find(p => p.name === 'factory');
      expect(factoryPattern).toBeDefined();
    });
  });

  describe('node properties', () => {
    it('should set correct node type', () => {
      const pages = [
        createTestPage({
          id: 'type-test',
          metadata: {
            tags: ['api'],
            category: 'api' as WikiCategory,
            sourceFiles: [],
            language: Language.TypeScript,
          },
          content: '```typescript\nexport class MyClass {}\n```',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);
      const apis = extractor.extractAPIs(pages);
      const patterns = extractor.extractPatterns(pages);

      expect(concepts.every(c => c.type === 'concept')).toBe(true);
      expect(apis.every(a => a.type === 'class' || a.type === 'interface' || a.type === 'function')).toBe(true);
      expect(patterns.every(p => p.type === 'pattern')).toBe(true);
    });

    it('should set source page id', () => {
      const pages = [
        createTestPage({
          id: 'source-test',
          content: '**TestConcept**',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts[0].sourcePageId).toBe('source-test');
    });

    it('should set metadata correctly', () => {
      const pages = [
        createTestPage({
          id: 'meta-test',
          content: '**TestConcept**',
        }),
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts[0].metadata).toBeDefined();
      expect(concepts[0].metadata.tags).toBeDefined();
      expect(concepts[0].metadata.visibility).toBeDefined();
    });
  });
});
