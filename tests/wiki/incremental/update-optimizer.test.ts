import { IncrementalUpdateOptimizer } from '../../../src/wiki/incremental/update-optimizer';
import { ChangeInfo, ChangeType } from '../../../src/wiki/incremental/types';

describe('IncrementalUpdateOptimizer', () => {
  let optimizer: IncrementalUpdateOptimizer;

  beforeEach(() => {
    optimizer = new IncrementalUpdateOptimizer();

    const dependencyGraph = new Map<string, Set<string>>();
    dependencyGraph.set('src/service.ts', new Set(['src/utils.ts']));
    dependencyGraph.set('src/api.ts', new Set(['src/service.ts']));
    optimizer.setDependencyGraph(dependencyGraph);

    const pageFileMap = new Map<string, Set<string>>();
    pageFileMap.set('page-service', new Set(['src/service.ts']));
    pageFileMap.set('page-api', new Set(['src/api.ts']));
    pageFileMap.set('page-utils', new Set(['src/utils.ts']));
    optimizer.setPageFileMap(pageFileMap);

    const symbolFileMap = new Map<string, Set<string>>();
    symbolFileMap.set('UserService', new Set(['src/service.ts']));
    symbolFileMap.set('getUser', new Set(['src/api.ts']));
    optimizer.setSymbolFileMap(symbolFileMap);
  });

  describe('analyzeChanges', () => {
    it('should analyze direct impacts', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.directImpacts.length).toBe(1);
      expect(analysis.directImpacts[0].filePath).toBe('src/service.ts');
    });

    it('should analyze indirect impacts via dependencies', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/utils.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.indirectImpacts.length).toBeGreaterThan(0);
    });

    it('should identify affected pages', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.affectedPages.length).toBeGreaterThan(0);
      expect(analysis.affectedPages.some((p) => p.pageId === 'page-service')).toBe(true);
    });

    it('should estimate update time', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.estimatedUpdateTime).toBeGreaterThan(0);
    });

    it('should determine appropriate strategy', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.recommendedStrategy.type).toBeDefined();
    });
  });

  describe('optimizeBatch', () => {
    it('should create batch plan from changes', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
        {
          filePath: 'src/api.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const plan = await optimizer.optimizeBatch(changes);

      expect(plan.batches.length).toBeGreaterThan(0);
      expect(plan.totalOperations).toBeGreaterThan(0);
    });

    it('should respect batch size configuration', async () => {
      const changes: ChangeInfo[] = Array.from({ length: 100 }, (_, i) => ({
        filePath: `src/file${i}.ts`,
        changeType: 'modified' as ChangeType,
        timestamp: new Date(),
      }));

      const plan = await optimizer.optimizeBatch(changes, { batchSize: 10 });

      expect(plan.batches.length).toBeGreaterThan(1);
      for (const batch of plan.batches) {
        expect(batch.operations.length).toBeLessThanOrEqual(10);
      }
    });

    it('should calculate parallel groups', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const plan = await optimizer.optimizeBatch(changes);

      expect(plan.parallelGroups).toBeGreaterThan(0);
    });
  });

  describe('executeOptimized', () => {
    it('should execute batch plan', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const plan = await optimizer.optimizeBatch(changes);
      const result = await optimizer.executeOptimized(plan);

      expect(result.success).toBe(true);
      expect(result.completedOperations).toBeGreaterThan(0);
    });

    it('should return performance metrics', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const plan = await optimizer.optimizeBatch(changes);
      const result = await optimizer.executeOptimized(plan);

      expect(result.metrics.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.filesProcessed).toBeGreaterThan(0);
    });
  });

  describe('prioritizeUpdates', () => {
    it('should prioritize updates by severity', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'deleted',
          timestamp: new Date(),
        },
        {
          filePath: 'src/utils.ts',
          changeType: 'added',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);
      const plans = optimizer.prioritizeUpdates(analysis);

      expect(plans.length).toBeGreaterThan(0);
    });

    it('should sort critical pages first', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'deleted',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);
      const plans = optimizer.prioritizeUpdates(analysis);

      const criticalPlans = plans.filter((p) => p.priority === 'critical');
      const normalPlans = plans.filter((p) => p.priority === 'normal');

      if (criticalPlans.length > 0 && normalPlans.length > 0) {
        const criticalIndex = plans.indexOf(criticalPlans[0]);
        const normalIndex = plans.indexOf(normalPlans[0]);
        expect(criticalIndex).toBeLessThan(normalIndex);
      }
    });
  });

  describe('strategy determination', () => {
    it('should use selective strategy for small changes', async () => {
      const changes: ChangeInfo[] = [
        {
          filePath: 'src/service.ts',
          changeType: 'modified',
          timestamp: new Date(),
        },
      ];

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.recommendedStrategy.type).toBe('selective');
    });

    it('should use incremental strategy for medium changes', async () => {
      const changes: ChangeInfo[] = Array.from({ length: 30 }, (_, i) => ({
        filePath: `src/file${i}.ts`,
        changeType: 'modified' as ChangeType,
        timestamp: new Date(),
      }));

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.recommendedStrategy.type).toBe('incremental');
    });

    it('should use full strategy for large changes', async () => {
      const changes: ChangeInfo[] = Array.from({ length: 150 }, (_, i) => ({
        filePath: `src/file${i}.ts`,
        changeType: 'modified' as ChangeType,
        timestamp: new Date(),
      }));

      const analysis = await optimizer.analyzeChanges(changes);

      expect(analysis.recommendedStrategy.type).toBe('full');
    });
  });

  describe('file hash management', () => {
    it('should store and retrieve file hashes', () => {
      optimizer.updateFileHash('src/test.ts', 'abc123');
      const hash = optimizer.getFileHash('src/test.ts');

      expect(hash).toBe('abc123');
    });

    it('should return undefined for unknown files', () => {
      const hash = optimizer.getFileHash('unknown.ts');

      expect(hash).toBeUndefined();
    });
  });
});
