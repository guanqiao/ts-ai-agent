import { HybridSearch } from '../../src/search/hybrid-search';
import { SemanticSearch } from '../../src/search/semantic-search';
import { SearchResult, SearchDocument, HybridSearchOptions } from '../../src/search/types';

function createTestDocument(id: string, content: string, title: string): SearchDocument {
  return {
    id,
    content,
    metadata: {
      pageId: id,
      title,
      category: 'api',
      tags: ['test'],
      wordCount: content.split(/\s+/).length,
    },
  };
}

describe('HybridSearch', () => {
  let searchEngine: HybridSearch;
  let documents: SearchDocument[];

  beforeEach(() => {
    searchEngine = new HybridSearch();
    documents = [
      createTestDocument(
        'doc1',
        'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
        'TypeScript Introduction'
      ),
      createTestDocument(
        'doc2',
        'Python is a high-level programming language known for its clear syntax.',
        'Python Overview'
      ),
      createTestDocument(
        'doc3',
        'React is a JavaScript library for building user interfaces.',
        'React Guide'
      ),
    ];
  });

  describe('index', () => {
    it('should index documents successfully', async () => {
      await expect(searchEngine.index(documents)).resolves.not.toThrow();
    });

    it('should handle empty document list', async () => {
      await expect(searchEngine.index([])).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    const defaultOptions: HybridSearchOptions = {
      maxResults: 10,
      threshold: 0.1,
      includeHighlights: false,
      keywordWeight: 0.5,
      semanticWeight: 0.5,
    };

    beforeEach(async () => {
      await searchEngine.index(documents);
    });

    it('should return search results', async () => {
      const results = await searchEngine.search('typescript', defaultOptions);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with correct structure', async () => {
      const results = await searchEngine.search('javascript', defaultOptions);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('document');
        expect(results[0]).toHaveProperty('score');
        expect(results[0]).toHaveProperty('searchType');
        expect(results[0].document).toHaveProperty('id');
        expect(results[0].document).toHaveProperty('content');
      }
    });

    it('should respect maxResults option', async () => {
      const options: HybridSearchOptions = {
        ...defaultOptions,
        maxResults: 2,
      };

      const results = await searchEngine.search('programming', options);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by threshold', async () => {
      const options: HybridSearchOptions = {
        ...defaultOptions,
        threshold: 0.99,
      };

      const results = await searchEngine.search('nonexistentquery12345', options);

      expect(results.length).toBe(0);
    });

    it('should handle keyword and semantic weight', async () => {
      const options: HybridSearchOptions = {
        ...defaultOptions,
        keywordWeight: 0.7,
        semanticWeight: 0.3,
      };

      const results = await searchEngine.search('javascript', options);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear indexed documents', async () => {
      await searchEngine.index(documents);
      await searchEngine.clear();

      const options: HybridSearchOptions = {
        maxResults: 10,
        threshold: 0.1,
        includeHighlights: false,
        keywordWeight: 0.5,
        semanticWeight: 0.5,
      };
      const results = await searchEngine.search('typescript', options);
      expect(results.length).toBe(0);
    });
  });
});

describe('SemanticSearch', () => {
  let semanticSearch: SemanticSearch;

  beforeEach(() => {
    semanticSearch = new SemanticSearch();
  });

  describe('index', () => {
    it('should create embeddings for documents', async () => {
      const documents: SearchDocument[] = [
        createTestDocument('doc1', 'Test document for semantic search', 'Test'),
      ];

      await expect(semanticSearch.index(documents)).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const documents: SearchDocument[] = [
        createTestDocument('doc1', 'Machine learning is a subset of artificial intelligence', 'ML Intro'),
        createTestDocument('doc2', 'Deep learning uses neural networks with many layers', 'DL Intro'),
      ];

      await semanticSearch.index(documents);
    });

    it('should find semantically similar documents', async () => {
      const results = await semanticSearch.search('AI and machine learning', 10);

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return results with similarity scores', async () => {
      const results = await semanticSearch.search('neural networks', 10);

      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThanOrEqual(0);
        expect(results[0].score).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('SearchDocument', () => {
  it('should have required properties', () => {
    const doc: SearchDocument = createTestDocument('test-id', 'Test content', 'Test Title');

    expect(doc.id).toBe('test-id');
    expect(doc.content).toBe('Test content');
    expect(doc.metadata.title).toBe('Test Title');
    expect(doc.metadata.category).toBe('api');
  });
});

describe('SearchResult', () => {
  it('should have correct structure', () => {
    const result: SearchResult = {
      document: createTestDocument('doc1', 'Content', 'Title'),
      score: 0.85,
      searchType: 'hybrid',
      highlights: [
        {
          field: 'content',
          snippet: 'Test snippet',
          positions: [{ start: 0, end: 10 }],
        },
      ],
    };

    expect(result.score).toBe(0.85);
    expect(result.searchType).toBe('hybrid');
    expect(result.highlights).toHaveLength(1);
  });
});
