import { WikiCategory } from '../wiki/types';

export interface SearchDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: SearchDocumentMetadata;
}

export interface SearchDocumentMetadata {
  pageId: string;
  section?: string;
  title: string;
  category: WikiCategory;
  tags: string[];
  wordCount: number;
  filePath?: string;
  language?: string;
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
  searchType: 'keyword' | 'semantic' | 'hybrid';
  highlights?: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  snippet: string;
  positions: { start: number; end: number }[];
}

export interface SearchOptions {
  maxResults: number;
  threshold: number;
  includeHighlights: boolean;
  filters?: SearchFilter[];
  boostFields?: Record<string, number>;
}

export interface HybridSearchOptions extends SearchOptions {
  keywordWeight: number;
  semanticWeight: number;
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: string | number | string[] | number[];
}

export interface SearchIndex {
  documents: Map<string, SearchDocument>;
  invertedIndex: Map<string, Set<string>>;
  embeddings: Map<string, number[]>;
  lastUpdated: Date;
}

export interface KeywordSearchResult {
  documentId: string;
  score: number;
  matchedTerms: string[];
  positions: { term: string; position: number }[];
}

export interface SemanticSearchResult {
  documentId: string;
  score: number;
  embedding: number[];
}

export interface ISearchEngine {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  removeDocument(documentId: string): Promise<void>;
  clear(): Promise<void>;
  getDocumentCount(): number;
}

export interface IKeywordSearch {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, maxResults: number): Promise<KeywordSearchResult[]>;
  removeDocument(documentId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ISemanticSearch {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, maxResults: number): Promise<SemanticSearchResult[]>;
  searchByEmbedding(embedding: number[], maxResults: number): Promise<SemanticSearchResult[]>;
  removeDocument(documentId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IVectorStore {
  initialize(): Promise<void>;
  addDocument(doc: SearchDocument): Promise<void>;
  addDocuments(docs: SearchDocument[]): Promise<void>;
  removeDocument(id: string): Promise<void>;
  search(query: string, k: number): Promise<SearchResult[]>;
  similaritySearch(embedding: number[], k: number): Promise<SearchResult[]>;
  getDocumentCount(): number;
  clear(): Promise<void>;
}

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export interface SearchSuggestion {
  text: string;
  score: number;
  type: 'completion' | 'correction' | 'related';
}

export interface SearchHistory {
  query: string;
  timestamp: Date;
  resultsCount: number;
  filters?: SearchFilter[];
}
