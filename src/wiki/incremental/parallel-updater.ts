import { WikiPage } from '../types';
import { AffectedPageInfo } from './impact-analyzer';

export interface UpdateTask {
  id: string;
  pageId: string;
  priority: number;
  dependencies: string[];
  estimatedTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface UpdateBatch {
  id: string;
  tasks: UpdateTask[];
  canRunInParallel: boolean;
}

export interface ParallelUpdateResult {
  totalPages: number;
  completedPages: string[];
  failedPages: string[];
  skippedPages: string[];
  totalTime: number;
  parallelism: number;
  batches: number;
}

export interface ParallelUpdateConfig {
  maxParallelism: number;
  batchSize: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: ParallelUpdateConfig = {
  maxParallelism: 4,
  batchSize: 10,
  timeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000,
};

export class ParallelUpdater {
  private config: ParallelUpdateConfig;
  private taskQueue: UpdateTask[] = [];
  private runningTasks: Map<string, UpdateTask> = new Map();
  private completedTasks: Map<string, UpdateTask> = new Map();
  private failedTasks: Map<string, UpdateTask> = new Map();

  constructor(config?: Partial<ParallelUpdateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  createTasks(affectedPages: AffectedPageInfo[]): UpdateTask[] {
    return affectedPages.map((page, index) => ({
      id: `task-${index}`,
      pageId: page.pageId,
      priority: this.priorityToNumber(page.priority),
      dependencies: [],
      estimatedTime: page.estimatedChanges * 50,
      status: 'pending' as const,
    }));
  }

  createBatches(tasks: UpdateTask[]): UpdateBatch[] {
    const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

    const dependencyGraph = this.buildDependencyGraph(sortedTasks);
    const levels = this.topologicalSort(sortedTasks, dependencyGraph);

    const batches: UpdateBatch[] = [];

    for (let i = 0; i < levels.length; i++) {
      const levelTasks = levels[i];
      const chunks = this.chunkArray(levelTasks, this.config.batchSize);

      for (const chunk of chunks) {
        batches.push({
          id: `batch-${batches.length}`,
          tasks: chunk,
          canRunInParallel: true,
        });
      }
    }

    return batches;
  }

  async executeBatches(
    batches: UpdateBatch[],
    updateFn: (pageId: string) => Promise<WikiPage>
  ): Promise<ParallelUpdateResult> {
    const startTime = Date.now();
    const completedPages: string[] = [];
    const failedPages: string[] = [];
    const skippedPages: string[] = [];

    for (const batch of batches) {
      const results = await this.executeBatch(batch, updateFn);

      for (const result of results) {
        if (result.status === 'completed') {
          completedPages.push(result.pageId);
        } else if (result.status === 'failed') {
          failedPages.push(result.pageId);
        } else {
          skippedPages.push(result.pageId);
        }
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      totalPages: completedPages.length + failedPages.length + skippedPages.length,
      completedPages,
      failedPages,
      skippedPages,
      totalTime,
      parallelism: this.config.maxParallelism,
      batches: batches.length,
    };
  }

  async updatePagesParallel(
    affectedPages: AffectedPageInfo[],
    updateFn: (pageId: string) => Promise<WikiPage>
  ): Promise<ParallelUpdateResult> {
    const tasks = this.createTasks(affectedPages);
    const batches = this.createBatches(tasks);
    return this.executeBatches(batches, updateFn);
  }

  getTaskStatus(taskId: string): UpdateTask | undefined {
    return (
      this.runningTasks.get(taskId) ||
      this.completedTasks.get(taskId) ||
      this.failedTasks.get(taskId) ||
      this.taskQueue.find(t => t.id === taskId)
    );
  }

  getProgress(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      pending: this.taskQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      total: this.taskQueue.length + this.runningTasks.size + this.completedTasks.size + this.failedTasks.size,
    };
  }

  private async executeBatch(
    batch: UpdateBatch,
    updateFn: (pageId: string) => Promise<WikiPage>
  ): Promise<UpdateTask[]> {
    const results: UpdateTask[] = [];

    if (batch.canRunInParallel) {
      const promises = batch.tasks.map(task => this.executeTask(task, updateFn));
      const taskResults = await Promise.allSettled(promises);

      for (let i = 0; i < taskResults.length; i++) {
        const result = taskResults[i];
        const task = batch.tasks[i];

        if (result.status === 'fulfilled') {
          task.status = 'completed';
          task.endTime = new Date();
          this.completedTasks.set(task.id, task);
        } else {
          task.status = 'failed';
          task.error = result.reason?.message || 'Unknown error';
          task.endTime = new Date();
          this.failedTasks.set(task.id, task);
        }

        results.push(task);
      }
    } else {
      for (const task of batch.tasks) {
        try {
          await this.executeTask(task, updateFn);
          task.status = 'completed';
          task.endTime = new Date();
          this.completedTasks.set(task.id, task);
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown error';
          task.endTime = new Date();
          this.failedTasks.set(task.id, task);
        }
        results.push(task);
      }
    }

    return results;
  }

  private async executeTask(
    task: UpdateTask,
    updateFn: (pageId: string) => Promise<WikiPage>
  ): Promise<WikiPage> {
    task.status = 'running';
    task.startTime = new Date();
    this.runningTasks.set(task.id, task);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await this.withTimeout(
          updateFn(task.pageId),
          this.config.timeout
        );

        this.runningTasks.delete(task.id);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    this.runningTasks.delete(task.id);
    throw lastError;
  }

  private buildDependencyGraph(tasks: UpdateTask[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const task of tasks) {
      graph.set(task.id, new Set(task.dependencies));
    }

    return graph;
  }

  private topologicalSort(
    tasks: UpdateTask[],
    dependencyGraph: Map<string, Set<string>>
  ): UpdateTask[][] {
    const levels: UpdateTask[][] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const inProgress = new Set<string>();

    const visit = (taskId: string, level: number): void => {
      if (visited.has(taskId)) {
        return;
      }

      if (inProgress.has(taskId)) {
        return;
      }

      inProgress.add(taskId);

      const deps = dependencyGraph.get(taskId);
      if (deps) {
        for (const depId of deps) {
          visit(depId, level + 1);
        }
      }

      inProgress.delete(taskId);
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        while (levels.length <= level) {
          levels.push([]);
        }
        levels[level].push(task);
      }
    };

    for (const task of tasks) {
      visit(task.id, 0);
    }

    return levels;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private priorityToNumber(priority: 'critical' | 'high' | 'normal' | 'low'): number {
    const mapping: Record<string, number> = {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4,
    };
    return mapping[priority] || 3;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
