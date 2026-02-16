import { NodeExtractor } from '../../../src/wiki/knowledge/node-extractor';
import { WikiPage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';

describe('NodeExtractor', () => {
  let extractor: NodeExtractor;

  beforeEach(() => {
    extractor = new NodeExtractor();
  });

  describe('extractConcepts', () => {
    it('should extract concepts from headings', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: `
# Main Concept

## Sub Concept - Description here

### Deep Concept

Some content here.
`,
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
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.length).toBeGreaterThan(0);
      expect(concepts.some(c => c.name.toLowerCase().includes('concept'))).toBe(true);
    });

    it('should extract concepts from bold text', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: `
This is about **KeyConcept** and **MainAPI**.
`,
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
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name === 'KeyConcept')).toBe(true);
      expect(concepts.some(c => c.name === 'MainAPI')).toBe(true);
    });

    it('should extract concepts from inline code', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: `
Use \`calculateTotal\` or \`userName\` for this purpose.
`,
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
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name === 'calculateTotal')).toBe(true);
      expect(concepts.some(c => c.name === 'userName')).toBe(true);
    });

    it('should extract concepts from tags', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: 'Content',
          format: DocumentFormat.Markdown,
          metadata: {
            tags: ['architecture', 'database', 'api'],
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
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name === 'architecture')).toBe(true);
      expect(concepts.some(c => c.name === 'database')).toBe(true);
      expect(concepts.some(c => c.name === 'api')).toBe(true);
    });

    it('should merge duplicate concepts', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Page 1',
          slug: 'page-1',
          content: '# SharedConcept',
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
        },
        {
          id: 'page-2',
          title: 'Page 2',
          slug: 'page-2',
          content: '# SharedConcept',
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
        },
      ];

      const concepts = extractor.extractConcepts(pages);

      const sharedConcept = concepts.find(c => c.name.toLowerCase() === 'sharedconcept');
      expect(sharedConcept).toBeDefined();
      expect(sharedConcept?.weight).toBe(2);
    });

    it('should filter out common words', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: `
**The** **and** **or** **but** **for** **with**
`,
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
        },
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name === 'The')).toBe(false);
      expect(concepts.some(c => c.name === 'and')).toBe(false);
    });

    it('should filter out short concepts', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: `
# A
# Ab
`,
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
        },
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts.some(c => c.name === 'A')).toBe(false);
      expect(concepts.some(c => c.name === 'Ab')).toBe(false);
    });
  });

  describe('extractAPIs', () => {
    it('should extract classes from code blocks', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'API Page',
          slug: 'api-page',
          content: `
\`\`\`typescript
export class UserService {
  // implementation
}

class InternalHelper {
  // implementation
}
\`\`\`
`,
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
        },
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'UserService')).toBe(true);
      expect(apis.some(a => a.name === 'InternalHelper')).toBe(true);
    });

    it('should extract interfaces from code blocks', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'API Page',
          slug: 'api-page',
          content: `
\`\`\`typescript
export interface IUser {
  id: string;
  name: string;
}
\`\`\`
`,
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
        },
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'IUser')).toBe(true);
    });

    it('should extract functions from code blocks', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'API Page',
          slug: 'api-page',
          content: `
\`\`\`typescript
export async function fetchUser(id: string): Promise<User> {
  // implementation
}

function helperFunction() {
  // implementation
}
\`\`\`
`,
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
        },
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.some(a => a.name === 'fetchUser')).toBe(true);
      expect(apis.some(a => a.name === 'helperFunction')).toBe(true);
    });

    it('should only extract from api and reference categories', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Overview Page',
          slug: 'overview-page',
          content: `
\`\`\`typescript
class ShouldNotExtract {
  // implementation
}
\`\`\`
`,
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
        },
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis.length).toBe(0);
    });
  });

  describe('extractPatterns', () => {
    it('should detect singleton pattern', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Pattern Page',
          slug: 'pattern-page',
          content: `
This uses the singleton pattern with getInstance method.
The instance is shared across the application.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name.toLowerCase().includes('singleton'))).toBe(true);
    });

    it('should detect factory pattern', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Pattern Page',
          slug: 'pattern-page',
          content: `
We use a factory to create objects.
The factory pattern helps us build instances.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name.toLowerCase().includes('factory'))).toBe(true);
    });

    it('should detect observer pattern', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Pattern Page',
          slug: 'pattern-page',
          content: `
The observer pattern is used here.
We subscribe to events and notify listeners.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns.some(p => p.name.toLowerCase().includes('observer'))).toBe(true);
    });

    it('should require multiple keyword matches', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Pattern Page',
          slug: 'pattern-page',
          content: `
Just one mention of singleton here.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      // Should not detect with only one keyword mention
      expect(patterns.some(p => p.name.toLowerCase().includes('singleton'))).toBe(false);
    });

    it('should merge pattern occurrences across pages', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Page 1',
          slug: 'page-1',
          content: `
Uses factory pattern with create method.
`,
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
        },
        {
          id: 'page-2',
          title: 'Page 2',
          slug: 'page-2',
          content: `
Also uses factory pattern with build method.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      const factoryPattern = patterns.find(p => p.name.toLowerCase().includes('factory'));
      expect(factoryPattern).toBeDefined();
      expect(factoryPattern?.weight).toBe(2);
    });
  });

  describe('node properties', () => {
    it('should set correct node type for concepts', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: '# TestConcept',
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
        },
      ];

      const concepts = extractor.extractConcepts(pages);

      expect(concepts[0]?.type).toBe('concept');
    });

    it('should set correct node type for APIs', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'API Page',
          slug: 'api-page',
          content: `
\`\`\`typescript
class TestClass {}
\`\`\`
`,
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
        },
      ];

      const apis = extractor.extractAPIs(pages);

      expect(apis[0]?.type).toBe('api');
    });

    it('should set correct node type for patterns', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Pattern Page',
          slug: 'pattern-page',
          content: `
singleton pattern with getInstance and instance.
`,
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
        },
      ];

      const patterns = extractor.extractPatterns(pages);

      expect(patterns[0]?.type).toBe('pattern');
    });

    it('should calculate importance based on frequency', () => {
      const pages: WikiPage[] = Array(10).fill(null).map((_, i) => ({
        id: `page-${i}`,
        title: `Page ${i}`,
        slug: `page-${i}`,
        content: '# PopularConcept',
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
      }));

      const concepts = extractor.extractConcepts(pages);

      const popularConcept = concepts.find(c => c.name.toLowerCase() === 'popularconcept');
      expect(popularConcept?.importance).toBeGreaterThan(0.5);
    });

    it('should generate unique IDs', () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Test Page',
          slug: 'test-page',
          content: '# Concept1\n# Concept2',
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
        },
      ];

      const concepts = extractor.extractConcepts(pages);

      const ids = concepts.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
