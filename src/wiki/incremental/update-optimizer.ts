import {
  ChangeInfo,
  ChangeType,
  ImpactAnalysis,
  DirectImpact,
  IndirectImpact,
  AffectedPage,
  UpdateStrategy,
  IUpdateOptimizer,
  BatchPlan,
  UpdateBatch,
  UpdateOperation,
  UpdateResult,
  UpdatePlan,
  BatchConfig,
  PerformanceMetrics,
  DEFAULT_UPDATE_CONFIG,
  IncrementalUpdateConfig,
  UpdatePriority,
} from './types';

export class IncrementalUpdateOptimizer implements IUpdateOptimizer {
  private config: IncrementalUpdateConfig;
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private pageFileMap: Map<string, Set<string>> = new Map();
  private symbolFileMap: Map<string, Set<string>> = new Map();
  private fileHashMap: Map<string, string> = new Map();

  constructor(config?: Partial<IncrementalUpdateConfig>) {
    this.config = { ...DEFAULT_UPDATE_CONFIG, ...config };
  }

  async analyzeChanges(changes: ChangeInfo[]): Promise<ImpactAnalysis> {
    const directImpacts = this.analyzeDirectImpacts(changes);
    const indirectImpacts = this.analyzeIndirectImpacts(changes, directImpacts);
    const affectedPages = this.analyzeAffectedPages(directImpacts, indirectImpacts);
    const estimatedUpdateTime = this.estimateUpdateTime(directImpacts, indirectImpacts);
    const recommendedStrategy = this.determineStrategy(changes, affectedPages);

    return {
      directImpacts,
      indirectImpacts,
      affectedPages,
      estimatedUpdateTime,
      recommendedStrategy,
    };
  }

  async optimizeBatch(changes: ChangeInfo[], config?: Partial<BatchConfig>): Promise<BatchPlan> {
    const batchConfig: BatchConfig = {
      batchSize: config?.batchSize || this.config.maxBatchSize,
      parallelism: config?.parallelism || this.config.parallelism,
      timeout: config?.timeout || 30000,
      retryAttempts: config?.retryAttempts || this.config.maxRetryAttempts,
    };

    const impactAnalysis = await this.analyzeChanges(changes);
    const operations = this.createOperations(changes, impactAnalysis);
    const batches = this.createBatches(operations, batchConfig);
    const parallelGroups = this.calculateParallelGroups(batches);
    const estimatedTime = this.estimateBatchTime(batches);

    return {
      batches,
      totalOperations: operations.length,
      estimatedTime,
      parallelGroups,
    };
  }

  async executeOptimized(plan: BatchPlan): Promise<UpdateResult> {
    const startTime = Date.now();
    let completedOperations = 0;
    let failedOperations = 0;
    const errors: { operation: UpdateOperation; error: string; retryCount: number }[] = [];

    for (const batch of plan.batches) {
      const batchResults = await this.executeBatch(batch);

      completedOperations += batchResults.completed;
      failedOperations += batchResults.failed;
      errors.push(...batchResults.errors);
    }

    const metrics: PerformanceMetrics = {
      totalTime: Date.now() - startTime,
      filesProcessed: completedOperations,
      pagesUpdated: completedOperations,
      cacheHits: 0,
      cacheMisses: 0,
      averageFileTime: 0,
      averagePageTime: 0,
    };

    return {
      success: failedOperations === 0,
      completedOperations,
      failedOperations,
      errors,
      metrics,
    };
  }

  prioritizeUpdates(impacts: ImpactAnalysis): UpdatePlan[] {
    const plans: UpdatePlan[] = [];
    const processedPages = new Set<string>();

    const criticalPages = impacts.affectedPages.filter((p) => p.priority === 'critical');
    for (const page of criticalPages) {
      if (!processedPages.has(page.pageId)) {
        plans.push(this.createUpdatePlan(page, impacts));
        processedPages.add(page.pageId);
      }
    }

    const highPages = impacts.affectedPages.filter((p) => p.priority === 'high');
    for (const page of highPages) {
      if (!processedPages.has(page.pageId)) {
        plans.push(this.createUpdatePlan(page, impacts));
        processedPages.add(page.pageId);
      }
    }

    const normalPages = impacts.affectedPages.filter((p) => p.priority === 'normal');
    for (const page of normalPages) {
      if (!processedPages.has(page.pageId)) {
        plans.push(this.createUpdatePlan(page, impacts));
        processedPages.add(page.pageId);
      }
    }

    const lowPages = impacts.affectedPages.filter((p) => p.priority === 'low');
    for (const page of lowPages) {
      if (!processedPages.has(page.pageId)) {
        plans.push(this.createUpdatePlan(page, impacts));
        processedPages.add(page.pageId);
      }
    }

    return plans;
  }

  setDependencyGraph(graph: Map<string, Set<string>>): void {
    this.dependencyGraph = graph;
  }

  setPageFileMap(map: Map<string, Set<string>>): void {
    this.pageFileMap = map;
  }

  setSymbolFileMap(map: Map<string, Set<string>>): void {
    this.symbolFileMap = map;
  }

  updateFileHash(filePath: string, hash: string): void {
    this.fileHashMap.set(filePath, hash);
  }

  getFileHash(filePath: string): string | undefined {
    return this.fileHashMap.get(filePath);
  }

  private analyzeDirectImpacts(changes: ChangeInfo[]): DirectImpact[] {
    return changes.map((change) => {
      const affectedSymbols = this.getAffectedSymbols(change.filePath);
      const severity = this.determineSeverity(change);

      return {
        filePath: change.filePath,
        changeType: change.changeType,
        affectedSymbols,
        severity,
      };
    });
  }

  private analyzeIndirectImpacts(
    _changes: ChangeInfo[],
    directImpacts: DirectImpact[]
  ): IndirectImpact[] {
    const indirectImpacts: IndirectImpact[] = [];
    const processedFiles = new Set<string>();

    for (const impact of directImpacts) {
      const dependents = this.getDependents(impact.filePath);

      for (const dependent of dependents) {
        if (processedFiles.has(dependent)) continue;
        processedFiles.add(dependent);

        indirectImpacts.push({
          filePath: dependent,
          viaFile: impact.filePath,
          impactType: 'dependency',
          severity: this.propagateSeverity(impact.severity),
        });
      }
    }

    return indirectImpacts;
  }

  private analyzeAffectedPages(
    directImpacts: DirectImpact[],
    indirectImpacts: IndirectImpact[]
  ): AffectedPage[] {
    const affectedPages: AffectedPage[] = [];
    const processedPages = new Set<string>();

    for (const impact of directImpacts) {
      const pages = this.getPagesForFile(impact.filePath);
      for (const pageId of pages) {
        if (processedPages.has(pageId)) continue;
        processedPages.add(pageId);

        affectedPages.push({
          pageId,
          pageTitle: pageId,
          impactType: 'content',
          priority: this.mapSeverityToPriority(impact.severity),
          estimatedChanges: 1,
        });
      }
    }

    for (const impact of indirectImpacts) {
      const pages = this.getPagesForFile(impact.filePath);
      for (const pageId of pages) {
        if (processedPages.has(pageId)) continue;
        processedPages.add(pageId);

        affectedPages.push({
          pageId,
          pageTitle: pageId,
          impactType: 'reference',
          priority: this.mapSeverityToPriority(impact.severity),
          estimatedChanges: 1,
        });
      }
    }

    return affectedPages;
  }

  private estimateUpdateTime(
    directImpacts: DirectImpact[],
    indirectImpacts: IndirectImpact[]
  ): number {
    const baseTime = 100;
    const directTime = directImpacts.length * baseTime;
    const indirectTime = indirectImpacts.length * baseTime * 0.5;

    return directTime + indirectTime;
  }

  private determineStrategy(changes: ChangeInfo[], affectedPages: AffectedPage[]): UpdateStrategy {
    if (changes.length > 100 || affectedPages.length > 50) {
      return {
        type: 'full',
        priority: 'normal',
        affectedFiles: changes.map((c) => c.filePath),
        affectedPages: affectedPages.map((p) => p.pageId),
        estimatedTime: this.estimateFullUpdateTime(changes.length),
      };
    }

    if (changes.length > 20 || affectedPages.length > 10) {
      return {
        type: 'incremental',
        priority: 'high',
        affectedFiles: changes.map((c) => c.filePath),
        affectedPages: affectedPages.map((p) => p.pageId),
        estimatedTime: this.estimateIncrementalUpdateTime(changes.length),
      };
    }

    return {
      type: 'selective',
      priority: 'high',
      affectedFiles: changes.map((c) => c.filePath),
      affectedPages: affectedPages.map((p) => p.pageId),
      estimatedTime: this.estimateSelectiveUpdateTime(changes.length),
    };
  }

  private createOperations(
    changes: ChangeInfo[],
    impactAnalysis: ImpactAnalysis
  ): UpdateOperation[] {
    const operations: UpdateOperation[] = [];

    for (const change of changes) {
      operations.push({
        type: 'parse-file',
        target: change.filePath,
        params: { changeType: change.changeType },
        priority: this.getOperationPriority(change.changeType),
      });
    }

    for (const page of impactAnalysis.affectedPages) {
      operations.push({
        type: 'update-page',
        target: page.pageId,
        params: { impactType: page.impactType },
        priority: this.mapPriorityToNumber(page.priority),
      });
    }

    operations.push({
      type: 'update-index',
      target: 'global',
      params: {},
      priority: 10,
    });

    return operations.sort((a, b) => a.priority - b.priority);
  }

  private createBatches(operations: UpdateOperation[], config: BatchConfig): UpdateBatch[] {
    const batches: UpdateBatch[] = [];
    const batchSize = config.batchSize;

    for (let i = 0; i < operations.length; i += batchSize) {
      const batchOperations = operations.slice(i, i + batchSize);
      const batch: UpdateBatch = {
        id: `batch-${Math.floor(i / batchSize)}`,
        operations: batchOperations,
        priority: this.determineBatchPriority(batchOperations),
        dependencies: i > 0 ? [`batch-${Math.floor(i / batchSize) - 1}`] : [],
        estimatedTime: batchOperations.length * 100,
      };
      batches.push(batch);
    }

    return batches;
  }

  private async executeBatch(batch: UpdateBatch): Promise<{
    completed: number;
    failed: number;
    errors: { operation: UpdateOperation; error: string; retryCount: number }[];
  }> {
    let completed = 0;
    let failed = 0;
    const errors: { operation: UpdateOperation; error: string; retryCount: number }[] = [];

    for (const operation of batch.operations) {
      try {
        await this.executeOperation(operation);
        completed++;
      } catch (error) {
        failed++;
        errors.push({
          operation,
          error: String(error),
          retryCount: 0,
        });
      }
    }

    return { completed, failed, errors };
  }

  private async executeOperation(_operation: UpdateOperation): Promise<void> {
    // Placeholder for actual operation execution
    // In real implementation, this would call the appropriate service
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  private calculateParallelGroups(batches: UpdateBatch[]): number {
    const dependencyGraph = new Map<string, string[]>();

    for (const batch of batches) {
      dependencyGraph.set(batch.id, batch.dependencies);
    }

    let maxDepth = 0;
    const visited = new Set<string>();

    const calculateDepth = (batchId: string, depth: number): void => {
      if (visited.has(batchId)) return;
      visited.add(batchId);
      maxDepth = Math.max(maxDepth, depth);

      const batch = batches.find((b) => b.id === batchId);
      if (batch) {
        for (const dep of batch.dependencies) {
          calculateDepth(dep, depth + 1);
        }
      }
    };

    for (const batch of batches) {
      calculateDepth(batch.id, 0);
    }

    return maxDepth + 1;
  }

  private estimateBatchTime(batches: UpdateBatch[]): number {
    return batches.reduce((sum, batch) => sum + batch.estimatedTime, 0);
  }

  private createUpdatePlan(page: AffectedPage, _impacts: ImpactAnalysis): UpdatePlan {
    const operations: UpdateOperation[] = [
      {
        type: 'update-page',
        target: page.pageId,
        params: { impactType: page.impactType },
        priority: this.mapPriorityToNumber(page.priority),
      },
    ];

    return {
      pageId: page.pageId,
      operations,
      priority: page.priority,
      dependencies: [],
      estimatedTime: page.estimatedChanges * 100,
    };
  }

  private getAffectedSymbols(filePath: string): string[] {
    const symbols: string[] = [];
    for (const [symbol, files] of this.symbolFileMap) {
      if (files.has(filePath)) {
        symbols.push(symbol);
      }
    }
    return symbols;
  }

  private determineSeverity(change: ChangeInfo): 'high' | 'medium' | 'low' {
    if (change.changeType === 'deleted') return 'high';
    if (change.changeType === 'added') return 'low';
    return 'medium';
  }

  private propagateSeverity(severity: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
    const severityMap: Record<string, 'high' | 'medium' | 'low'> = {
      high: 'medium',
      medium: 'low',
      low: 'low',
    };
    return severityMap[severity];
  }

  private getDependents(filePath: string): string[] {
    const dependents: string[] = [];
    for (const [file, deps] of this.dependencyGraph) {
      if (deps.has(filePath)) {
        dependents.push(file);
      }
    }
    return dependents;
  }

  private getPagesForFile(filePath: string): string[] {
    const pages: string[] = [];
    for (const [pageId, files] of this.pageFileMap) {
      if (files.has(filePath)) {
        pages.push(pageId);
      }
    }
    return pages;
  }

  private mapSeverityToPriority(severity: 'high' | 'medium' | 'low'): UpdatePriority {
    const mapping: Record<string, UpdatePriority> = {
      high: 'critical',
      medium: 'normal',
      low: 'low',
    };
    return mapping[severity];
  }

  private getOperationPriority(changeType: ChangeType): number {
    const priorityMap: Record<ChangeType, number> = {
      deleted: 1,
      modified: 2,
      renamed: 3,
      added: 4,
    };
    return priorityMap[changeType];
  }

  private mapPriorityToNumber(priority: UpdatePriority): number {
    const mapping: Record<UpdatePriority, number> = {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4,
    };
    return mapping[priority];
  }

  private determineBatchPriority(operations: UpdateOperation[]): UpdatePriority {
    const avgPriority = operations.reduce((sum, op) => sum + op.priority, 0) / operations.length;

    if (avgPriority <= 1.5) return 'critical';
    if (avgPriority <= 2.5) return 'high';
    if (avgPriority <= 3.5) return 'normal';
    return 'low';
  }

  private estimateFullUpdateTime(fileCount: number): number {
    return fileCount * 200 + 5000;
  }

  private estimateIncrementalUpdateTime(fileCount: number): number {
    return fileCount * 150 + 2000;
  }

  private estimateSelectiveUpdateTime(fileCount: number): number {
    return fileCount * 100 + 500;
  }
}
