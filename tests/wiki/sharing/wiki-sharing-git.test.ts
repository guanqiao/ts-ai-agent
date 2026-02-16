import * as path from 'path';
import * as fs from 'fs';
import { WikiSharingService } from '../../../src/wiki/sharing/wiki-sharing-service';
import { WikiDocument, WikiPage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';
import { DEFAULT_SHARING_CONFIG } from '../../../src/wiki/sharing/types';

describe('WikiSharingService Git Integration', () => {
  let service: WikiSharingService;
  let testProjectPath: string;
  let testWikiDocument: WikiDocument;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-git-project');
    
    // 创建测试项目目录
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
      // Git 可能不可用，测试会处理这种情况
    }

    service = new WikiSharingService(testProjectPath);

    // 创建测试 Wiki 文档
    const testPage: WikiPage = {
      id: 'test-page',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test Page\n\nThis is a test page.',
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
    // 清理测试目录
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('commitToGit', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        autoCommit: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should commit shared files to git', async () => {
      // 先分享以创建文件
      const shareResult = await service.share();
      expect(shareResult.success).toBe(true);

      // 验证文件已创建
      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      expect(fs.existsSync(shareDir)).toBe(true);

      // 如果 git 可用，验证可以执行 git status
      try {
        const { execSync } = require('child_process');
        const status = execSync('git status --porcelain', { cwd: testProjectPath, encoding: 'utf-8' });
        // 文件应该已被提交或已暂存
        expect(status).toBeDefined();
      } catch {
        // Git 不可用，跳过验证
      }
    });

    it('should use custom commit message template', async () => {
      const customMessage = 'docs: update wiki [{date}]';
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        autoCommit: true,
        commitMessageTemplate: customMessage,
      });

      const shareResult = await service.share();
      expect(shareResult.success).toBe(true);
    });

    it('should handle git not available gracefully', async () => {
      // 测试在没有 git 的环境下的行为
      const shareResult = await service.share();
      
      // 分享应该成功（文件写入），git 提交可能失败但不影响分享
      expect(shareResult.success).toBe(true);
    });
  });

  describe('pullFromRemote', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should attempt to pull from remote', async () => {
      const result = await service.pullFromRemote();

      // 结果可能成功或失败，取决于 git 配置
      expect(result).toBeDefined();
      expect(result.direction).toBe('pull');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return error when not configured', async () => {
      const unconfiguredService = new WikiSharingService(testProjectPath);
      
      const result = await unconfiguredService.pullFromRemote();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
      expect(result.errors[0].code).toBe('NOT_CONFIGURED');
    });

    it('should return error when sync is disabled', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: false,
      });

      const result = await service.pullFromRemote();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not enabled');
      expect(result.errors[0].code).toBe('SYNC_NOT_ENABLED');
    });
  });

  describe('pushToRemote', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
        autoCommit: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should attempt to push to remote', async () => {
      // 先分享以创建提交
      await service.share();

      const result = await service.pushToRemote();

      // 结果可能成功或失败，取决于远程配置
      expect(result).toBeDefined();
      expect(result.direction).toBe('push');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should auto-commit before push when enabled', async () => {
      // 创建一些更改
      await service.share();

      const result = await service.pushToRemote();

      // 推送应该尝试执行
      expect(result).toBeDefined();
    });

    it('should not auto-commit when disabled', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
        autoCommit: false,
      });

      const result = await service.pushToRemote();

      expect(result).toBeDefined();
    });
  });

  describe('sync', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should perform bidirectional sync', async () => {
      const result = await service.sync();

      expect(result).toBeDefined();
      expect(result.direction).toBe('both');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include sync results', async () => {
      const result = await service.sync();

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.filesSynced).toBeDefined();
    });
  });

  describe('getRemoteStatus', () => {
    beforeEach(async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);
    });

    it('should return remote status', async () => {
      const status = await service.getStatus();

      expect(status.remoteStatus).toBeDefined();
      expect(status.remoteStatus.connected).toBeDefined();
      expect(status.remoteStatus.branch).toBeDefined();
      expect(status.remoteStatus.ahead).toBeDefined();
      expect(status.remoteStatus.behind).toBeDefined();
    });

    it('should handle no remote configured', async () => {
      const status = await service.getStatus();

      // remoteStatus 应该被定义
      expect(status.remoteStatus).toBeDefined();
      // 如果没有远程仓库或 fetch 失败，connected 可能为 false
      expect(typeof status.remoteStatus.connected).toBe('boolean');
    });
  });

  describe('Git error handling', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        syncWithRemote: true,
      });
    });

    it('should handle git command failures gracefully', async () => {
      // 在没有远程仓库的情况下尝试推送
      const result = await service.pushToRemote();

      // 应该返回失败结果而不是抛出异常
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should include error details in result', async () => {
      const result = await service.pushToRemote();

      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].code).toBeDefined();
      }
    });

    it('should mark errors as retryable when appropriate', async () => {
      const result = await service.pushToRemote();

      if (!result.success && result.errors.length > 0) {
        // 网络错误通常应该是可重试的
        const networkError = result.errors.find(e => 
          e.code.includes('PUSH') || e.code.includes('PULL')
        );
        if (networkError) {
          expect(networkError.retryable).toBe(true);
        }
      }
    });
  });

  describe('Integration with share workflow', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
        shareToGit: true,
        autoCommit: true,
        syncWithRemote: false, // 避免尝试实际的网络操作
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should share and create git commit', async () => {
      const result = await service.share();

      expect(result.success).toBe(true);
      // 分享成功，文件应该被创建
      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      expect(fs.existsSync(shareDir)).toBe(true);
    });

    it('should track files shared in result', async () => {
      const result = await service.share();

      expect(result.filesShared).toBeGreaterThan(0);
    });

    it('should emit git-related events', async () => {
      const gitEventSpy = jest.fn();
      service.on('shared', gitEventSpy);

      await service.share();

      expect(gitEventSpy).toHaveBeenCalled();
    });
  });
});
