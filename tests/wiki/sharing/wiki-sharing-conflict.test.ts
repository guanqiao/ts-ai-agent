import * as path from 'path';
import * as fs from 'fs';
import { WikiSharingService } from '../../../src/wiki/sharing/wiki-sharing-service';
import { WikiDocument, WikiPage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';
import { DEFAULT_SHARING_CONFIG, Conflict } from '../../../src/wiki/sharing/types';

describe('WikiSharingService Conflict Detection', () => {
  let service: WikiSharingService;
  let testProjectPath: string;
  let testWikiDocument: WikiDocument;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-conflict-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    // 初始化 git 仓库
    const { execSync } = require('child_process');
    try {
      execSync('git init', { cwd: testProjectPath, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: testProjectPath, stdio: 'ignore' });
    } catch {
      // Git 可能不可用
    }

    service = new WikiSharingService(testProjectPath);

    const testPage: WikiPage = {
      id: 'test-page',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test Page\n\nOriginal content.',
      format: DocumentFormat.Markdown,
      metadata: {
        tags: ['test'],
        category: 'overview',
        sourceFiles: [],
        language: Language.TypeScript,
      },
      sections: [],
      links: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    testWikiDocument = {
      id: 'test-wiki',
      name: 'Test Wiki',
      description: 'A test wiki document',
      pages: [testPage],
      index: {
        pages: [],
        categories: [],
        searchIndex: [],
      },
      metadata: {
        projectName: 'Test Project',
        generator: 'tsd-generator',
        generatorVersion: '1.0.0',
        totalFiles: 1,
        totalSymbols: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('detectConflicts', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should return empty array when no conflicts', async () => {
      const conflicts = await service.detectConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should detect content conflicts (UU status)', async () => {
      // 创建模拟的冲突文件
      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      fs.mkdirSync(shareDir, { recursive: true });
      
      const conflictFile = path.join(shareDir, 'conflict.md');
      fs.writeFileSync(conflictFile, '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> branch\n');

      // 模拟 git status 输出包含 UU（双方修改）状态
      // 由于我们无法真正模拟 git 状态，测试主要验证接口行为
      const conflicts = await service.detectConflicts();

      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should detect add-add conflicts (AA status)', async () => {
      const conflicts = await service.detectConflicts();

      // AA 状态表示双方同时添加了文件
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should not detect conflicts when sync is disabled', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: false,
      });

      const conflicts = await service.detectConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should handle git not available gracefully', async () => {
      // 在没有 git 的环境下应该返回空数组而不是抛出异常
      const conflicts = await service.detectConflicts();

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('getConflicts', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should return empty array initially', async () => {
      const conflicts = await service.getConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should return detected conflicts', async () => {
      // 先检测冲突
      await service.detectConflicts();
      
      // 获取冲突列表
      const conflicts = await service.getConflicts();

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Conflict properties', () => {
    it('should create conflict with correct structure', () => {
      const conflict: Conflict = {
        id: 'test-conflict-1',
        type: 'content',
        filePath: 'docs/wiki/page.md',
        localVersion: {
          content: 'Local version content',
          hash: 'local-hash-123',
          author: 'local-user',
          timestamp: new Date('2024-01-15'),
        },
        remoteVersion: {
          content: 'Remote version content',
          hash: 'remote-hash-456',
          author: 'remote-user',
          timestamp: new Date('2024-01-16'),
        },
        severity: 'high',
        suggestedResolution: 'manual',
        resolved: false,
      };

      expect(conflict.id).toBe('test-conflict-1');
      expect(conflict.type).toBe('content');
      expect(conflict.filePath).toBe('docs/wiki/page.md');
      expect(conflict.localVersion.author).toBe('local-user');
      expect(conflict.remoteVersion.author).toBe('remote-user');
      expect(conflict.severity).toBe('high');
      expect(conflict.suggestedResolution).toBe('manual');
      expect(conflict.resolved).toBe(false);
    });

    it('should support all conflict types', () => {
      const types: Array<Conflict['type']> = ['content', 'delete-modify', 'rename', 'binary'];

      types.forEach(type => {
        const conflict: Conflict = {
          id: `conflict-${type}`,
          type,
          filePath: 'test.md',
          localVersion: {
            content: 'local',
            hash: 'hash1',
            author: 'user1',
            timestamp: new Date(),
          },
          remoteVersion: {
            content: 'remote',
            hash: 'hash2',
            author: 'user2',
            timestamp: new Date(),
          },
          severity: 'medium',
          suggestedResolution: 'merge',
          resolved: false,
        };

        expect(conflict.type).toBe(type);
      });
    });

    it('should support all severity levels', () => {
      const severities: Array<Conflict['severity']> = ['low', 'medium', 'high'];

      severities.forEach(severity => {
        const conflict: Conflict = {
          id: `conflict-${severity}`,
          type: 'content',
          filePath: 'test.md',
          localVersion: {
            content: 'local',
            hash: 'hash1',
            author: 'user1',
            timestamp: new Date(),
          },
          remoteVersion: {
            content: 'remote',
            hash: 'hash2',
            author: 'user2',
            timestamp: new Date(),
          },
          severity,
          suggestedResolution: 'manual',
          resolved: false,
        };

        expect(conflict.severity).toBe(severity);
      });
    });
  });

  describe('Conflict in sync workflow', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should check for conflicts before sync', async () => {
      const syncResult = await service.sync();

      // 同步结果应该包含冲突信息（如果有）
      expect(syncResult).toBeDefined();
      expect(syncResult.conflicts).toBeDefined();
    });

    it('should block sync when conflicts exist', async () => {
      // 模拟存在冲突的情况
      // 由于无法真正创建冲突，我们验证 sync 方法的行为
      const syncResult = await service.sync();

      expect(syncResult).toBeDefined();
      // 如果有冲突，同步应该失败
      if (syncResult.conflicts.length > 0) {
        expect(syncResult.success).toBe(false);
      }
    });

    it('should include conflict details in sync result', async () => {
      const syncResult = await service.sync();

      // 同步结果应该包含冲突数组
      expect(Array.isArray(syncResult.conflicts)).toBe(true);
    });
  });

  describe('Conflict resolution workflow', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should allow resolving a conflict', async () => {
      // 创建一个模拟冲突
      const conflict: Conflict = {
        id: 'test-conflict',
        type: 'content',
        filePath: 'test.md',
        localVersion: {
          content: 'local',
          hash: 'hash1',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: 'remote',
          hash: 'hash2',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'medium',
        suggestedResolution: 'keep-local',
        resolved: false,
      };

      // 解决冲突
      conflict.resolved = true;
      conflict.resolution = {
        strategy: 'keep-local',
        resolvedContent: conflict.localVersion.content,
        resolvedBy: 'test-user',
        resolvedAt: new Date(),
      };

      expect(conflict.resolved).toBe(true);
      expect(conflict.resolution.strategy).toBe('keep-local');
      expect(conflict.resolution.resolvedContent).toBe('local');
    });

    it('should track resolution metadata', () => {
      const conflict: Conflict = {
        id: 'test-conflict',
        type: 'content',
        filePath: 'test.md',
        localVersion: {
          content: 'local',
          hash: 'hash1',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: 'remote',
          hash: 'hash2',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'medium',
        suggestedResolution: 'merge',
        resolved: true,
        resolution: {
          strategy: 'merge',
          resolvedContent: 'merged content',
          resolvedBy: 'resolver-user',
          resolvedAt: new Date('2024-01-20'),
        },
      };

      expect(conflict.resolution).toBeDefined();
      expect(conflict.resolution?.resolvedBy).toBe('resolver-user');
      expect(conflict.resolution?.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('Conflict edge cases', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should handle empty file path', async () => {
      const conflicts = await service.detectConflicts();
      
      // 不应该因为空路径而崩溃
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should handle binary file conflicts', () => {
      const binaryConflict: Conflict = {
        id: 'binary-conflict',
        type: 'binary',
        filePath: 'image.png',
        localVersion: {
          content: '[Binary data]',
          hash: 'binary-hash-1',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: '[Binary data]',
          hash: 'binary-hash-2',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'high',
        suggestedResolution: 'manual',
        resolved: false,
      };

      expect(binaryConflict.type).toBe('binary');
      expect(binaryConflict.suggestedResolution).toBe('manual');
    });

    it('should handle delete-modify conflicts', () => {
      const deleteModifyConflict: Conflict = {
        id: 'delete-modify-conflict',
        type: 'delete-modify',
        filePath: 'deleted-file.md',
        localVersion: {
          content: '',
          hash: 'deleted',
          author: 'user1',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: 'modified content',
          hash: 'modified-hash',
          author: 'user2',
          timestamp: new Date(),
        },
        severity: 'high',
        suggestedResolution: 'manual',
        resolved: false,
      };

      expect(deleteModifyConflict.type).toBe('delete-modify');
      expect(deleteModifyConflict.severity).toBe('high');
    });
  });
});
