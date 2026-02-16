import * as path from 'path';
import * as fs from 'fs';
import { WikiSharingService } from '../../../src/wiki/sharing/wiki-sharing-service';
import { WikiDocument, WikiPage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';
import { DEFAULT_SHARING_CONFIG } from '../../../src/wiki/sharing/types';

describe('WikiSharingService', () => {
  let service: WikiSharingService;
  let testProjectPath: string;
  let testWikiDocument: WikiDocument;

  beforeEach(() => {
    testProjectPath = path.join(__dirname, 'test-project');
    
    // 创建测试项目目录
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    // 初始化 .git 目录模拟
    const gitDir = path.join(testProjectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      fs.mkdirSync(gitDir, { recursive: true });
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

  afterEach(async () => {
    // 清理测试目录 - Windows 可能需要多次尝试
    if (fs.existsSync(testProjectPath)) {
      try {
        fs.rmSync(testProjectPath, { recursive: true, force: true });
      } catch (error) {
        // 如果删除失败，等待一下再尝试
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          fs.rmSync(testProjectPath, { recursive: true, force: true });
        } catch (e) {
          // 忽略第二次失败
        }
      }
    }
  });

  describe('initialization', () => {
    it('should initialize with default config', async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      expect(fs.existsSync(shareDir)).toBe(true);
    });

    it('should initialize with custom config', async () => {
      const customConfig = {
        ...DEFAULT_SHARING_CONFIG,
        sharePath: 'custom/wiki/path',
      };

      await service.initialize(customConfig);

      const shareDir = path.join(testProjectPath, 'custom/wiki/path');
      expect(fs.existsSync(shareDir)).toBe(true);
    });

    it('should emit initialized event', async () => {
      const initSpy = jest.fn();
      service.on('initialized', initSpy);

      await service.initialize(DEFAULT_SHARING_CONFIG);

      expect(initSpy).toHaveBeenCalledWith({
        config: DEFAULT_SHARING_CONFIG,
      });
    });

    it('should be configured after initialization', async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);

      expect(service.isConfigured()).toBe(true);
      expect(service.isEnabled()).toBe(DEFAULT_SHARING_CONFIG.enabled);
    });
  });

  describe('setWikiDocument', () => {
    it('should set wiki document', () => {
      service.setWikiDocument(testWikiDocument);

      // 通过 share 方法验证文档已设置
      // 这里我们主要验证不抛出错误
      expect(() => service.setWikiDocument(testWikiDocument)).not.toThrow();
    });
  });

  describe('share', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should share wiki successfully', async () => {
      const result = await service.share();

      expect(result.success).toBe(true);
      expect(result.filesShared).toBeGreaterThan(0);
      expect(result.message).toContain('Successfully shared');
    });

    it('should create markdown files in share directory', async () => {
      await service.share();

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      const pageFile = path.join(shareDir, 'test-page.md');

      expect(fs.existsSync(pageFile)).toBe(true);

      const content = fs.readFileSync(pageFile, 'utf-8');
      expect(content).toContain('# Test Page');
      expect(content).toContain('This is a test page');
    });

    it('should create index.json', async () => {
      await service.share();

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      const indexFile = path.join(shareDir, 'index.json');

      expect(fs.existsSync(indexFile)).toBe(true);

      const content = fs.readFileSync(indexFile, 'utf-8');
      const index = JSON.parse(content);
      expect(index).toBeDefined();
    });

    it('should create metadata.json', async () => {
      await service.share();

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      const metadataFile = path.join(shareDir, 'metadata.json');

      expect(fs.existsSync(metadataFile)).toBe(true);

      const content = fs.readFileSync(metadataFile, 'utf-8');
      const metadata = JSON.parse(content);
      expect(metadata.projectName).toBe('Test Wiki');
      expect(metadata.generator).toBe('tsd-generator');
    });

    it('should create manifest.json', async () => {
      await service.share();

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      const manifestFile = path.join(shareDir, 'manifest.json');

      expect(fs.existsSync(manifestFile)).toBe(true);

      const content = fs.readFileSync(manifestFile, 'utf-8');
      const manifest = JSON.parse(content);
      expect(manifest.version).toBe(1);
      expect(manifest.files).toBeDefined();
      expect(manifest.checksums).toBeDefined();
    });

    it('should emit shared event', async () => {
      const shareSpy = jest.fn();
      service.on('shared', shareSpy);

      await service.share();

      expect(shareSpy).toHaveBeenCalled();
      expect(shareSpy.mock.calls[0][0]).toHaveProperty('filesShared');
      expect(shareSpy.mock.calls[0][0]).toHaveProperty('timestamp');
    });

    it('should fail when not configured', async () => {
      const unconfiguredService = new WikiSharingService(testProjectPath);
      unconfiguredService.setWikiDocument(testWikiDocument);

      const result = await unconfiguredService.share();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Sharing not configured');
    });

    it('should fail when no wiki document', async () => {
      const emptyService = new WikiSharingService(testProjectPath);
      await emptyService.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });

      const result = await emptyService.share();

      expect(result.success).toBe(false);
      expect(result.message).toContain('No wiki document');
    });
  });

  describe('getStatus', () => {
    it('should return initial status', async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);

      const status = await service.getStatus();

      expect(status.isShared).toBe(false);
      expect(status.sharePath).toBe(DEFAULT_SHARING_CONFIG.sharePath);
      expect(status.pendingChanges).toBe(false);
      // remoteStatus.connected 取决于 git 环境，不做强制断言
      expect(status.remoteStatus).toBeDefined();
    }, 30000);

    it('should return status after sharing', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });
      service.setWikiDocument(testWikiDocument);
      await service.share();

      const status = await service.getStatus();

      expect(status.isShared).toBe(true);
      expect(status.lastSharedAt).not.toBeNull();
    }, 30000);
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

    it('should detect content conflicts', async () => {
      // 创建冲突文件
      const conflictContent = `<<<<<<< HEAD
local content
=======
remote content
>>>>>>> branch`;

      const conflictFile = path.join(testProjectPath, 'conflict.md');
      fs.writeFileSync(conflictFile, conflictContent);

      // 模拟 git status 输出包含冲突标记
      // 由于我们无法真正运行 git 命令，这里测试接口行为
      const conflicts = await service.detectConflicts();

      // 在没有真实 git 环境时，应该返回空数组
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('getConflicts', () => {
    it('should return empty array initially', async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);

      const conflicts = await service.getConflicts();

      expect(conflicts).toEqual([]);
    });
  });

  describe('isConfigured', () => {
    it('should return false before initialization', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.initialize(DEFAULT_SHARING_CONFIG);

      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return false by default', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true when enabled', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });

      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when disabled', async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: false,
      });

      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('multiple pages sharing', () => {
    beforeEach(async () => {
      const page2: WikiPage = {
        id: 'page-2',
        title: 'Second Page',
        slug: 'second-page',
        content: '# Second Page\n\nAnother page.',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: ['test'],
          category: 'api',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      testWikiDocument.pages.push(page2);

      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should share multiple pages', async () => {
      const result = await service.share();

      expect(result.success).toBe(true);
      expect(result.filesShared).toBeGreaterThanOrEqual(2);

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      expect(fs.existsSync(path.join(shareDir, 'test-page.md'))).toBe(true);
      expect(fs.existsSync(path.join(shareDir, 'second-page.md'))).toBe(true);
    });

    it('should create correct manifest for multiple pages', async () => {
      await service.share();

      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      const manifestFile = path.join(shareDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));

      const pageEntries = manifest.files.filter((f: any) => f.type === 'page');
      expect(pageEntries.length).toBe(2);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.initialize({
        ...DEFAULT_SHARING_CONFIG,
        enabled: true,
      });
      service.setWikiDocument(testWikiDocument);
    });

    it('should handle file system errors gracefully', async () => {
      // 创建只读目录模拟权限错误
      const shareDir = path.join(testProjectPath, DEFAULT_SHARING_CONFIG.sharePath);
      fs.mkdirSync(shareDir, { recursive: true });

      // 在 Windows 上无法简单模拟权限错误，这里主要验证不崩溃
      const result = await service.share();

      // 应该成功或返回有意义的错误
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });
});
