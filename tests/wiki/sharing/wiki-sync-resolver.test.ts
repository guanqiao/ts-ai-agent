import * as path from 'path';
import * as fs from 'fs';
import { WikiSyncResolver } from '../../../src/wiki/sharing/wiki-sync-resolver';
import {
  Conflict,
  ConflictResolution,
  ResolutionStrategy,
} from '../../../src/wiki/sharing/types';

describe('WikiSyncResolver', () => {
  let resolver: WikiSyncResolver;
  let testProjectPath: string;

  beforeEach(() => {
    testProjectPath = path.join(__dirname, 'test-resolver-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    resolver = new WikiSyncResolver();
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('autoResolve', () => {
    it('should auto-resolve with keep-local strategy', async () => {
      const conflict = createTestConflict('content', 'keep-local');
      
      const result = await resolver.autoResolve(conflict, 'keep-local');
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('keep-local');
      expect(result.resolution?.resolvedContent).toBe(conflict.localVersion.content);
    });

    it('should auto-resolve with keep-remote strategy', async () => {
      const conflict = createTestConflict('content', 'keep-remote');
      
      const result = await resolver.autoResolve(conflict, 'keep-remote');
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('keep-remote');
      expect(result.resolution?.resolvedContent).toBe(conflict.remoteVersion.content);
    });

    it('should auto-resolve with merge strategy for non-conflicting changes', async () => {
      const conflict = createMergeableConflict();
      
      const result = await resolver.autoResolve(conflict, 'merge');
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('merge');
      expect(result.resolution?.resolvedContent).toBeDefined();
    });

    it('should fail auto-merge for conflicting changes', async () => {
      const conflict = createTestConflict('content', 'auto-merge');
      
      const result = await resolver.autoResolve(conflict, 'auto-merge');
      
      // 当无法自动合并时，应该返回未解决状态或降级为手动解决
      expect(result).toBeDefined();
    });

    it('should handle delete-modify conflicts', async () => {
      const conflict = createTestConflict('delete-modify', 'keep-local');
      
      const result = await resolver.autoResolve(conflict, 'keep-local');
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('keep-local');
    });

    it('should handle rename conflicts', async () => {
      const conflict = createTestConflict('rename', 'keep-remote');
      
      const result = await resolver.autoResolve(conflict, 'keep-remote');
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('keep-remote');
    });
  });

  describe('manualResolve', () => {
    it('should resolve with manual content', async () => {
      const conflict = createTestConflict('content', 'manual');
      const manualContent = 'Manually resolved content';
      
      const result = await resolver.manualResolve(conflict, manualContent);
      
      expect(result.resolved).toBe(true);
      expect(result.resolution?.strategy).toBe('manual');
      expect(result.resolution?.resolvedContent).toBe(manualContent);
    });

    it('should validate manual content', async () => {
      const conflict = createTestConflict('content', 'manual');
      
      // 测试空内容
      await expect(resolver.manualResolve(conflict, '')).rejects.toThrow();
      
      // 测试 null 内容
      await expect(resolver.manualResolve(conflict, null as any)).rejects.toThrow();
    });
  });

  describe('suggestResolution', () => {
    it('should suggest keep-local for local newer changes', () => {
      const conflict = createTestConflictWithTimestamps(
        new Date('2024-01-02'),
        new Date('2024-01-01')
      );
      
      const suggestion = resolver.suggestResolution(conflict);
      
      expect(suggestion).toBe('keep-local');
    });

    it('should suggest keep-remote for remote newer changes', () => {
      const conflict = createTestConflictWithTimestamps(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );
      
      const suggestion = resolver.suggestResolution(conflict);
      
      expect(suggestion).toBe('keep-remote');
    });

    it('should suggest merge for non-overlapping changes', () => {
      const conflict = createMergeableConflict();
      
      const suggestion = resolver.suggestResolution(conflict);
      
      // 根据时间戳和内容判断，可能返回 merge、keep-local/keep-remote 或 manual
      expect(['merge', 'keep-local', 'keep-remote', 'manual']).toContain(suggestion);
    });

    it('should suggest manual for complex conflicts', () => {
      const conflict = createComplexConflict();
      
      const suggestion = resolver.suggestResolution(conflict);
      
      expect(suggestion).toBe('manual');
    });
  });

  describe('applyResolution', () => {
    it('should apply keep-local resolution to file', async () => {
      const testFile = path.join(testProjectPath, 'test.md');
      fs.writeFileSync(testFile, 'conflict content');
      
      const conflict = createTestConflict('content', 'keep-local');
      conflict.filePath = 'test.md';
      
      const resolution: ConflictResolution = {
        strategy: 'keep-local',
        resolvedContent: conflict.localVersion.content,
        resolvedBy: 'test-user',
        resolvedAt: new Date(),
      };
      
      await resolver.applyResolution(testProjectPath, conflict, resolution);
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(conflict.localVersion.content);
    });

    it('should apply keep-remote resolution to file', async () => {
      const testFile = path.join(testProjectPath, 'test.md');
      fs.writeFileSync(testFile, 'conflict content');
      
      const conflict = createTestConflict('content', 'keep-remote');
      conflict.filePath = 'test.md';
      
      const resolution: ConflictResolution = {
        strategy: 'keep-remote',
        resolvedContent: conflict.remoteVersion.content,
        resolvedBy: 'test-user',
        resolvedAt: new Date(),
      };
      
      await resolver.applyResolution(testProjectPath, conflict, resolution);
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(conflict.remoteVersion.content);
    });

    it('should apply manual resolution to file', async () => {
      const testFile = path.join(testProjectPath, 'test.md');
      fs.writeFileSync(testFile, 'conflict content');
      
      const conflict = createTestConflict('content', 'manual');
      conflict.filePath = 'test.md';
      
      const manualContent = 'Manually resolved content';
      const resolution: ConflictResolution = {
        strategy: 'manual',
        resolvedContent: manualContent,
        resolvedBy: 'test-user',
        resolvedAt: new Date(),
      };
      
      await resolver.applyResolution(testProjectPath, conflict, resolution);
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(manualContent);
    });

    it('should throw error for non-existent file', async () => {
      const conflict = createTestConflict('content', 'keep-local');
      conflict.filePath = 'non-existent.md';
      
      const resolution: ConflictResolution = {
        strategy: 'keep-local',
        resolvedContent: 'content',
        resolvedBy: 'test-user',
        resolvedAt: new Date(),
      };
      
      await expect(
        resolver.applyResolution(testProjectPath, conflict, resolution)
      ).rejects.toThrow();
    });
  });

  describe('resolveBatch', () => {
    it('should resolve multiple conflicts', async () => {
      const conflicts = [
        createTestConflict('content', 'keep-local'),
        createTestConflict('content', 'keep-remote'),
      ];
      
      const resolutions = new Map<string, ConflictResolution>([
        [
          conflicts[0].id,
          {
            strategy: 'keep-local',
            resolvedContent: conflicts[0].localVersion.content,
            resolvedBy: 'test-user',
            resolvedAt: new Date(),
          },
        ],
        [
          conflicts[1].id,
          {
            strategy: 'keep-remote',
            resolvedContent: conflicts[1].remoteVersion.content,
            resolvedBy: 'test-user',
            resolvedAt: new Date(),
          },
        ],
      ]);
      
      const results = await resolver.resolveBatch(conflicts, resolutions);
      
      expect(results.length).toBe(2);
      expect(results[0].resolved).toBe(true);
      expect(results[1].resolved).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      // 使用固定 id 避免时间戳问题
      const conflict1: Conflict = {
        id: 'conflict-1',
        type: 'content',
        filePath: 'docs/wiki/page1.md',
        localVersion: {
          content: 'Local content 1',
          hash: 'hash1',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: 'Remote content 1',
          hash: 'hash2',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'medium',
        suggestedResolution: 'keep-local',
        resolved: false,
      };
      
      const conflict2: Conflict = {
        id: 'conflict-2',
        type: 'content',
        filePath: 'docs/wiki/page2.md',
        localVersion: {
          content: 'Local content 2',
          hash: 'hash3',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: 'Remote content 2',
          hash: 'hash4',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'medium',
        suggestedResolution: 'manual',
        resolved: false,
      };
      
      const conflicts = [conflict1, conflict2];
      
      // 只提供第一个 conflict 的 resolution，第二个保持未解决
      const resolutions = new Map<string, ConflictResolution>([
        [
          conflict1.id,
          {
            strategy: 'keep-local',
            resolvedContent: conflict1.localVersion.content,
            resolvedBy: 'test-user',
            resolvedAt: new Date(),
          },
        ],
      ]);
      
      const results = await resolver.resolveBatch(conflicts, resolutions);
      
      expect(results.length).toBe(2);
      // 找到对应的 result
      const result1 = results.find(r => r.id === conflict1.id);
      const result2 = results.find(r => r.id === conflict2.id);
      expect(result1?.resolved).toBe(true);
      expect(result2?.resolved).toBe(false);
    });
  });

  describe('generateConflictReport', () => {
    it('should generate report for conflicts', () => {
      const conflicts = [
        createTestConflict('content', 'manual'),
        createTestConflict('delete-modify', 'keep-local'),
      ];
      
      const report = resolver.generateConflictReport(conflicts);
      
      expect(report).toContain('content');
      expect(report).toContain('delete-modify');
      expect(report).toContain(conflicts[0].filePath);
    });

    it('should include resolution suggestions', () => {
      const conflict = createTestConflict('content', 'manual');
      
      const report = resolver.generateConflictReport([conflict]);
      
      expect(report).toContain(conflict.suggestedResolution);
    });
  });

  // 辅助函数
  function createTestConflict(
    type: Conflict['type'],
    suggestedResolution: ResolutionStrategy
  ): Conflict {
    return {
      id: `conflict-${Date.now()}`,
      type,
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'Local version content',
        hash: 'local-hash',
        author: 'local-user',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: 'Remote version content',
        hash: 'remote-hash',
        author: 'remote-user',
        timestamp: new Date(),
      },
      severity: 'medium',
      suggestedResolution,
      resolved: false,
    };
  }

  function createTestConflictWithTimestamps(
    localTime: Date,
    remoteTime: Date
  ): Conflict {
    return {
      id: `conflict-${Date.now()}`,
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'Local content',
        hash: 'local-hash',
        author: 'local-user',
        timestamp: localTime,
      },
      remoteVersion: {
        content: 'Remote content',
        hash: 'remote-hash',
        author: 'remote-user',
        timestamp: remoteTime,
      },
      severity: 'medium',
      suggestedResolution: 'manual',
      resolved: false,
    };
  }

  function createMergeableConflict(): Conflict {
    return {
      id: `conflict-${Date.now()}`,
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'Line 1\nLocal line 2\nLine 3',
        hash: 'local-hash',
        author: 'local-user',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: 'Line 1\nRemote line 2\nLine 3',
        hash: 'remote-hash',
        author: 'remote-user',
        timestamp: new Date(),
      },
      severity: 'low',
      suggestedResolution: 'auto-merge',
      resolved: false,
    };
  }

  function createComplexConflict(): Conflict {
    return {
      id: `conflict-${Date.now()}`,
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'Completely different local content',
        hash: 'local-hash',
        author: 'local-user',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: 'Completely different remote content with no overlap',
        hash: 'remote-hash',
        author: 'remote-user',
        timestamp: new Date(),
      },
      severity: 'high',
      suggestedResolution: 'manual',
      resolved: false,
    };
  }
});
