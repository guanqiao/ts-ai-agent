import { DocumentFormat, Language, ParsedFile } from '../types';
import { ArchitectureReport } from '../architecture/types';
import { ChangeSet } from '../sync/types';

export interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  format: DocumentFormat;
  metadata: WikiPageMetadata;
  sections: WikiSection[];
  links: WikiLink[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface WikiPageMetadata {
  author?: string;
  tags: string[];
  category: WikiCategory;
  sourceFiles: string[];
  language: Language;
  commitHash?: string;
  custom?: Record<string, unknown>;
}

export interface WikiSection {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
}

export interface WikiLink {
  text: string;
  target: string;
  type: 'internal' | 'external' | 'cross-reference';
}

export type WikiCategory =
  | 'overview'
  | 'architecture'
  | 'api'
  | 'guide'
  | 'reference'
  | 'changelog'
  | 'decision'
  | 'module';

export interface WikiDocument {
  id: string;
  name: string;
  description?: string;
  pages: WikiPage[];
  index: WikiIndex;
  metadata: WikiDocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiIndex {
  pages: WikiPageIndexEntry[];
  categories: WikiCategoryIndex[];
  searchIndex: WikiSearchEntry[];
}

export interface WikiPageIndexEntry {
  id: string;
  title: string;
  slug: string;
  category: WikiCategory;
  tags: string[];
  wordCount: number;
}

export interface WikiCategoryIndex {
  category: WikiCategory;
  pages: string[];
  description?: string;
}

export interface WikiSearchEntry {
  pageId: string;
  keywords: string[];
  summary: string;
}

export interface WikiDocumentMetadata {
  projectName: string;
  projectVersion?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  generator: string;
  generatorVersion: string;
  totalFiles: number;
  totalSymbols: number;
}

export interface WikiAnswer {
  question: string;
  answer: string;
  relatedPages: string[];
  confidence: number;
  sources: WikiAnswerSource[];
}

export interface WikiAnswerSource {
  pageId: string;
  pageTitle: string;
  relevance: number;
  excerpt?: string;
}

export interface WikiEvent {
  type: 'page-created' | 'page-updated' | 'page-deleted' | 'wiki-regenerated';
  pageId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export type WikiEventCallback = (event: WikiEvent) => void | Promise<void>;

// ==================== 进度监控类型 ====================

export type GenerationPhase = 'initialization' | 'analysis' | 'generation' | 'finalization';

export type ProgressEventType =
  | 'generation-started'
  | 'generation-completed'
  | 'generation-error'
  | 'architecture-analyzing'
  | 'architecture-analyzed'
  | 'page-generating'
  | 'page-generated'
  | 'page-saving'
  | 'index-building'
  | 'storage-saving'
  | 'knowledge-indexing'
  | 'snapshot-creating';

export interface WikiProgressEvent {
  type: ProgressEventType;
  phase: GenerationPhase;
  progress: number;
  current: number;
  total: number;
  message: string;
  timestamp: Date;
  pageId?: string;
  pageTitle?: string;
  details?: Record<string, unknown>;
}

export interface ProgressInfo {
  phase: GenerationPhase;
  progress: number;
  current: number;
  total: number;
  message: string;
  percentage: string;
}

export type ProgressCallback = (info: ProgressInfo) => void;

export interface GenerationStats {
  totalFiles: number;
  totalSymbols: number;
  totalPages: number;
  phases: PhaseStats[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors: GenerationError[];
}

export interface PhaseStats {
  phase: GenerationPhase;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemsProcessed: number;
  totalItems: number;
}

export interface GenerationError {
  phase: GenerationPhase;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface WikiOptions {
  outputDir: string;
  format: DocumentFormat;
  language?: Language;
  includePrivate?: boolean;
  generateIndex?: boolean;
  generateSearch?: boolean;
  watchMode?: boolean;
  autoUpdate?: boolean;
  onProgress?: ProgressCallback;
  verbose?: boolean;
}

export interface WikiContext {
  projectPath: string;
  outputPath: string;
  parsedFiles: ParsedFile[];
  architecture?: ArchitectureReport;
  changeSet?: ChangeSet;
  options: WikiOptions;
}

export interface IWikiManager {
  initialize(projectPath: string, options: WikiOptions): Promise<void>;
  generate(context: WikiContext): Promise<WikiDocument>;
  update(changeSet: ChangeSet): Promise<void>;
  query(question: string): Promise<WikiAnswer>;
  export(format: DocumentFormat): Promise<string>;
  watch(callback: WikiEventCallback): void;
  stopWatching(): void;
  getPage(pageId: string): Promise<WikiPage | null>;
  listPages(): Promise<WikiPage[]>;
  deletePage(pageId: string): Promise<void>;
}

export interface IWikiStorage {
  save(document: WikiDocument): Promise<void>;
  load(projectPath: string): Promise<WikiDocument | null>;
  savePage(page: WikiPage): Promise<void>;
  loadPage(pageId: string): Promise<WikiPage | null>;
  deletePage(pageId: string): Promise<void>;
  listPages(): Promise<WikiPage[]>;
  exists(): Promise<boolean>;
}

export interface IWikiKnowledgeBase {
  index(document: WikiDocument): Promise<void>;
  query(question: string): Promise<WikiAnswer>;
  search(keywords: string[]): Promise<WikiPage[]>;
  getRelatedPages(pageId: string): Promise<WikiPage[]>;
  getContext(topic: string): Promise<string>;
}

// ==================== 版本控制与历史记录类型 ====================

export interface WikiPageVersion {
  version: number;
  pageId: string;
  title: string;
  content: string;
  metadata: WikiPageMetadata;
  sections: WikiSection[];
  links: WikiLink[];
  createdAt: Date;
  updatedAt: Date;
  changeSummary?: string;
  changedBy?: string;
}

export interface WikiPageHistory {
  pageId: string;
  versions: WikiPageVersion[];
  currentVersion: number;
}

export interface WikiDiffResult {
  oldVersion: number;
  newVersion: number;
  additions: number;
  deletions: number;
  changes: WikiDiffChange[];
}

export interface WikiDiffChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
  section?: string;
}

export interface WikiAuditLog {
  id: string;
  action: 'page-created' | 'page-updated' | 'page-deleted' | 'page-rolled-back' | 'version-viewed';
  pageId: string;
  pageTitle: string;
  version?: number;
  oldVersion?: number;
  newVersion?: number;
  performedBy?: string;
  performedAt: Date;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export interface WikiAuditLogQuery {
  pageId?: string;
  action?: string;
  performedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IWikiHistory {
  saveVersion(page: WikiPage, changeSummary?: string, changedBy?: string): Promise<WikiPageVersion>;
  getVersion(pageId: string, version: number): Promise<WikiPageVersion | null>;
  getHistory(pageId: string): Promise<WikiPageHistory | null>;
  listVersions(pageId: string, limit?: number, offset?: number): Promise<WikiPageVersion[]>;
  compareVersions(pageId: string, oldVersion: number, newVersion: number): Promise<WikiDiffResult>;
  rollback(pageId: string, targetVersion: number, performedBy?: string): Promise<WikiPage | null>;
  deleteVersion(pageId: string, version: number): Promise<boolean>;
  cleanupOldVersions(pageId: string, keepCount: number): Promise<number>;
}

export interface IWikiAudit {
  log(
    action: WikiAuditLog['action'],
    data: Omit<WikiAuditLog, 'id' | 'performedAt' | 'action'>
  ): Promise<WikiAuditLog>;
  query(query: WikiAuditLogQuery): Promise<WikiAuditLog[]>;
  getRecentLogs(limit?: number): Promise<WikiAuditLog[]>;
  getPageLogs(pageId: string, limit?: number): Promise<WikiAuditLog[]>;
  exportLogs(startDate: Date, endDate: Date): Promise<WikiAuditLog[]>;
}

// ==================== 自动同步与监控类型 ====================

export interface AutoSyncConfig {
  onProjectOpen: boolean;
  onGitChange: boolean;
  debounceMs: number;
  backgroundMode: boolean;
  notifyOnOutdated: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface SyncStatus {
  isSynced: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  outdatedPages: OutdatedPage[];
  errors: SyncError[];
}

export interface OutdatedPage {
  pageId: string;
  pageTitle: string;
  lastSyncedCommit: string;
  currentCommit: string;
  changedFiles: string[];
  outdatedSince: Date;
  severity: 'low' | 'medium' | 'high';
}

export interface SyncError {
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface ReminderConfig {
  enabled: boolean;
  intervalMs: number;
  notificationType: 'console' | 'file' | 'callback';
  callback?: (outdatedPages: OutdatedPage[]) => void | Promise<void>;
}

export interface ChangeImpact {
  affectedPages: string[];
  affectedModules: string[];
  suggestedUpdates: SuggestedUpdate[];
}

export interface SuggestedUpdate {
  pageId: string;
  section: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface IWikiAutoSync {
  start(config: AutoSyncConfig): Promise<void>;
  stop(): void;
  getStatus(): SyncStatus;
  forceSync(): Promise<void>;
  isRunning(): boolean;
}

export interface IWikiSyncMonitor {
  checkSyncStatus(): Promise<SyncStatus>;
  getOutdatedPages(): Promise<OutdatedPage[]>;
  scheduleReminders(config: ReminderConfig): void;
  cancelReminders(): void;
  getChangeImpact(filePath: string): Promise<ChangeImpact>;
  markAsSynced(pageIds: string[]): Promise<void>;
}

// ==================== 向量搜索与语义检索类型 ====================

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: VectorDocumentMetadata;
}

export interface VectorDocumentMetadata {
  pageId: string;
  section?: string;
  title: string;
  category: WikiCategory;
  tags: string[];
  wordCount: number;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  searchType: 'keyword' | 'semantic' | 'hybrid';
  highlights?: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  snippet: string;
  positions: { start: number; end: number }[];
}

export interface HybridSearchOptions {
  keywordWeight: number;
  semanticWeight: number;
  maxResults: number;
  threshold: number;
  includeHighlights: boolean;
  filters?: SearchFilter[];
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number | string[] | number[];
}

export interface IVectorStore {
  initialize(): Promise<void>;
  addDocument(doc: VectorDocument): Promise<void>;
  addDocuments(docs: VectorDocument[]): Promise<void>;
  removeDocument(id: string): Promise<void>;
  search(query: string, k: number): Promise<SearchResult[]>;
  similaritySearch(embedding: number[], k: number): Promise<SearchResult[]>;
  getDocumentCount(): number;
  clear(): Promise<void>;
}

export interface IHybridSearch {
  search(query: string, options: HybridSearchOptions): Promise<SearchResult[]>;
  indexDocument(doc: VectorDocument): Promise<void>;
  removeDocument(docId: string): Promise<void>;
  reindex(): Promise<void>;
}

// ==================== 上下文压缩与记忆类型 ====================

export interface CompressedContext {
  summary: string;
  keyPoints: string[];
  tokens: number;
  originalTokens: number;
  compressionRatio: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CodingPattern {
  type: 'naming' | 'structure' | 'comment' | 'import' | 'export';
  pattern: string;
  examples: string[];
  frequency: number;
  lastSeen: Date;
}

export interface ProjectConvention {
  id: string;
  name: string;
  description: string;
  patterns: CodingPattern[];
  examples: string[];
  confidence: number;
  discoveredAt: Date;
}

export interface EnhancedPrompt {
  original: string;
  enhanced: string;
  additions: PromptAddition[];
  context: string[];
}

export interface PromptAddition {
  type: 'architecture' | 'convention' | 'dependency' | 'example';
  content: string;
  source: string;
}

export interface IContextCompressor {
  compress(context: string, targetTokens: number): Promise<CompressedContext>;
  extractKeyPoints(context: string): Promise<string[]>;
  summarizeHistory(messages: ConversationMessage[]): Promise<string>;
  estimateTokens(text: string): number;
}

export interface IWikiMemory {
  learnPattern(pattern: CodingPattern): Promise<void>;
  getPatterns(type?: CodingPattern['type']): Promise<CodingPattern[]>;
  discoverConventions(parsedFiles: ParsedFile[]): Promise<ProjectConvention[]>;
  getConventions(): Promise<ProjectConvention[]>;
  applyConventions(code: string): string;
  clear(): Promise<void>;
}

export interface IPromptEnhancer {
  enhance(prompt: string, context?: WikiContext): Promise<EnhancedPrompt>;
  getSuggestions(partialPrompt: string): Promise<string[]>;
  addTemplate(name: string, template: string): void;
  getTemplates(): Map<string, string>;
}
