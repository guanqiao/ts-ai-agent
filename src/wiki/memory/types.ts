export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  metadata: MemoryMetadata;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessedAt?: Date;
}

export enum MemoryEntryType {
  Code = 'code',
  Documentation = 'documentation',
  Architecture = 'architecture',
  Decision = 'decision',
  Pattern = 'pattern',
  API = 'api',
  Module = 'module',
  Config = 'config',
  Test = 'test',
  Example = 'example',
}

export interface MemoryMetadata {
  source: string;
  pageId?: string;
  filePath?: string;
  symbolName?: string;
  tags: string[];
  relevance: number;
  confidence: number;
}

export interface MemoryQuery {
  text: string;
  types?: MemoryEntryType[];
  tags?: string[];
  filePath?: string;
  symbolName?: string;
  limit?: number;
  threshold?: number;
  includeExpired?: boolean;
}

export interface MemoryResult {
  entry: MemoryEntry;
  score: number;
  highlights?: MemoryHighlight[];
}

export interface MemoryHighlight {
  field: string;
  snippet: string;
  positions: Array<{ start: number; end: number }>;
}

export interface MemoryContext {
  entries: MemoryEntry[];
  summary: string;
  totalTokens: number;
  relevanceScore: number;
}

export interface IMemoryService {
  store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>
  ): Promise<MemoryEntry>;
  query(query: MemoryQuery): Promise<MemoryResult[]>;
  invalidate(filter: Partial<MemoryQuery>): Promise<number>;
  getRelevant(context: string, limit?: number): Promise<MemoryEntry[]>;
  getById(id: string): Promise<MemoryEntry | null>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface IKnowledgeCache {
  cache(key: string, entry: MemoryEntry, ttl?: number): Promise<void>;
  get(key: string): Promise<MemoryEntry | null>;
  invalidate(key: string): Promise<boolean>;
  invalidatePattern(pattern: string): Promise<number>;
  refresh(key: string): Promise<MemoryEntry | null>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageAge: number;
}

export interface IAgentMemoryBridge {
  provideContext(query: string, maxTokens?: number): Promise<MemoryContext>;
  enrichPrompt(prompt: string, context?: MemoryContext): Promise<string>;
  storeKnowledge(
    content: string,
    type: MemoryEntryType,
    metadata?: Partial<MemoryMetadata>
  ): Promise<MemoryEntry>;
  getRelevantSymbols(symbolName: string): Promise<MemoryEntry[]>;
  getRelevantFiles(filePath: string): Promise<MemoryEntry[]>;
}

export interface MemoryStoreConfig {
  maxEntries: number;
  maxTokensPerEntry: number;
  defaultTTL: number;
  enableEmbeddings: boolean;
  embeddingModel?: string;
}

export const DEFAULT_MEMORY_CONFIG: MemoryStoreConfig = {
  maxEntries: 10000,
  maxTokensPerEntry: 2000,
  defaultTTL: 7 * 24 * 60 * 60 * 1000,
  enableEmbeddings: true,
  embeddingModel: 'text-embedding-ada-002',
};

export interface MemoryIndex {
  byType: Map<MemoryEntryType, Set<string>>;
  byTag: Map<string, Set<string>>;
  byFile: Map<string, Set<string>>;
  bySymbol: Map<string, Set<string>>;
  byPage: Map<string, Set<string>>;
}
