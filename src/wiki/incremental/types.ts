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
