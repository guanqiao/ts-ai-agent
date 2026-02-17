export interface IncrementalUpdateConfig {
  maxBatchSize: number;
  parallelism: number;
  debounceMs: number;
  maxRetryAttempts: number;
  enableCaching: boolean;
  cacheTTL: number;
}

export const DEFAULT_UPDATE_CONFIG: IncrementalUpdateConfig = {
  maxBatchSize: 50,
  parallelism: 4,
  debounceMs: 300,
  maxRetryAttempts: 3,
  enableCaching: true,
  cacheTTL: 60 * 60 * 1000,
};

export interface UpdateStrategy {
  type: 'full' | 'incremental' | 'selective';
  priority: UpdatePriority;
  affectedFiles: string[];
  affectedPages: string[];
  estimatedTime: number;
}

export type UpdatePriority = 'critical' | 'high' | 'normal' | 'low';

export interface BatchConfig {
  batchSize: number;
  parallelism: number;
  timeout: number;
  retryAttempts: number;
}

export interface PerformanceMetrics {
  totalTime: number;
  filesProcessed: number;
  pagesUpdated: number;
  cacheHits: number;
  cacheMisses: number;
  averageFileTime: number;
  averagePageTime: number;
}

export interface ChangeInfo {
  filePath: string;
  changeType: ChangeType;
  timestamp: Date;
  oldHash?: string;
  newHash?: string;
}

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ImpactAnalysis {
  directImpacts: DirectImpact[];
  indirectImpacts: IndirectImpact[];
  affectedPages: AffectedPage[];
  estimatedUpdateTime: number;
  recommendedStrategy: UpdateStrategy;
}

export interface DirectImpact {
  filePath: string;
  changeType: ChangeType;
  affectedSymbols: string[];
  severity: 'high' | 'medium' | 'low';
}

export interface IndirectImpact {
  filePath: string;
  viaFile: string;
  impactType: 'dependency' | 'reference' | 'documentation';
  severity: 'high' | 'medium' | 'low';
}

export interface AffectedPage {
  pageId: string;
  pageTitle: string;
  impactType: 'content' | 'reference' | 'metadata';
  priority: UpdatePriority;
  estimatedChanges: number;
}

export interface IUpdateOptimizer {
  analyzeChanges(changes: ChangeInfo[]): Promise<ImpactAnalysis>;
  optimizeBatch(changes: ChangeInfo[], config?: Partial<BatchConfig>): Promise<BatchPlan>;
  executeOptimized(plan: BatchPlan): Promise<UpdateResult>;
  prioritizeUpdates(impacts: ImpactAnalysis): UpdatePlan[];
}

export interface BatchPlan {
  batches: UpdateBatch[];
  totalOperations: number;
  estimatedTime: number;
  parallelGroups: number;
}

export interface UpdateBatch {
  id: string;
  operations: UpdateOperation[];
  priority: UpdatePriority;
  dependencies: string[];
  estimatedTime: number;
}

export interface UpdateOperation {
  type: OperationType;
  target: string;
  params: Record<string, unknown>;
  priority: number;
}

export type OperationType =
  | 'parse-file'
  | 'update-page'
  | 'regenerate-section'
  | 'update-references'
  | 'update-index'
  | 'invalidate-cache';

export interface UpdateResult {
  success: boolean;
  completedOperations: number;
  failedOperations: number;
  errors: UpdateError[];
  metrics: PerformanceMetrics;
}

export interface UpdateError {
  operation: UpdateOperation;
  error: string;
  retryCount: number;
}

export interface UpdatePlan {
  pageId: string;
  operations: UpdateOperation[];
  priority: UpdatePriority;
  dependencies: string[];
  estimatedTime: number;
}

export interface IncrementalUpdateResult {
  success: boolean;
  strategy: 'full' | 'incremental' | 'selective';
  pagesUpdated: string[];
  pagesUnchanged: string[];
  pagesAdded: string[];
  pagesDeleted: string[];
  filesProcessed: number;
  totalTime: number;
  changePercentage: number;
  metrics: IncrementalUpdateMetrics;
}

export interface IncrementalUpdateMetrics {
  parseTime: number;
  analysisTime: number;
  updateTime: number;
  saveTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface PageUpdatePlan {
  pageId: string;
  pageTitle: string;
  updateType: PageUpdateType;
  mergeStrategy: ContentMergeStrategy;
  sectionsToUpdate: SectionUpdatePlan[];
  preserveContent: boolean;
  reason: string;
}

export type PageUpdateType = 
  | 'regenerate'
  | 'merge'
  | 'partial-update'
  | 'skip';

export type ContentMergeStrategy = 
  | 'replace-sections'
  | 'append-new'
  | 'smart-merge'
  | 'symbol-level';

export interface SectionUpdatePlan {
  sectionId: string;
  sectionTitle: string;
  action: 'replace' | 'merge' | 'append' | 'delete';
  newContent?: string;
  mergePoints?: MergePoint[];
}

export interface MergePoint {
  position: 'before' | 'after' | 'replace';
  target: string;
  content: string;
}

export interface SymbolChange {
  symbolName: string;
  symbolKind: string;
  filePath: string;
  changeType: ChangeType;
  oldSignature?: string;
  newSignature?: string;
  oldDescription?: string;
  newDescription?: string;
}

export interface WikiSnapshot {
  id: string;
  timestamp: Date;
  commitHash: string;
  pages: WikiPageSnapshot[];
  fileHashMap: Map<string, string>;
  symbolFileMap: Map<string, Set<string>>;
  pageFileMap: Map<string, Set<string>>;
}

export interface WikiPageSnapshot {
  pageId: string;
  pageTitle: string;
  version: number;
  contentHash: string;
  sourceFiles: string[];
  symbols: string[];
  updatedAt: Date;
}

export interface IncrementalContext {
  existingDocument: import('../types').WikiDocument | null;
  lastSnapshot: WikiSnapshot | null;
  currentFiles: import('../../types').ParsedFile[];
  changes: ChangeInfo[];
  changePercentage: number;
  useIncremental: boolean;
}

export interface PageContentDiff {
  pageId: string;
  addedSections: string[];
  modifiedSections: SectionDiff[];
  deletedSections: string[];
  unchangedSections: string[];
}

export interface SectionDiff {
  sectionId: string;
  sectionTitle: string;
  oldContent: string;
  newContent: string;
  diffLines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

export const INCREMENTAL_THRESHOLD = {
  fullRegeneration: 50,
  incrementalUpdate: 20,
  selectiveUpdate: 5,
};

export const PAGE_UPDATE_RULES = {
  overview: {
    triggers: ['file-count-change', 'symbol-count-change', 'architecture-change'],
    mergeStrategy: 'replace-sections' as ContentMergeStrategy,
  },
  architecture: {
    triggers: ['dependency-change', 'pattern-change', 'layer-change'],
    mergeStrategy: 'smart-merge' as ContentMergeStrategy,
  },
  module: {
    triggers: ['file-in-module-change', 'symbol-in-module-change'],
    mergeStrategy: 'symbol-level' as ContentMergeStrategy,
  },
  api: {
    triggers: ['symbol-change', 'signature-change', 'description-change'],
    mergeStrategy: 'symbol-level' as ContentMergeStrategy,
  },
};
