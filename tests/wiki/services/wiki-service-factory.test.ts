import { WikiServiceFactory, WikiServiceTokens } from '@wiki/services';
import { DIContainer, ServiceLocator, ServiceLifetime } from '@core/di';

describe('WikiServiceFactory', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
    ServiceLocator.setContainer(container);
  });

  afterEach(() => {
    ServiceLocator.reset();
  });

  describe('registerServices', () => {
    it('should register all wiki services', () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      expect(container.has(WikiServiceTokens.Storage)).toBe(true);
      expect(container.has(WikiServiceTokens.History)).toBe(true);
      expect(container.has(WikiServiceTokens.Audit)).toBe(true);
      expect(container.has(WikiServiceTokens.AutoSync)).toBe(true);
      expect(container.has(WikiServiceTokens.SyncMonitor)).toBe(true);
      expect(container.has(WikiServiceTokens.SharingService)).toBe(true);
      expect(container.has(WikiServiceTokens.GraphGenerator)).toBe(true);
      expect(container.has(WikiServiceTokens.EditorService)).toBe(true);
      expect(container.has(WikiServiceTokens.DiagramGenerator)).toBe(true);
      expect(container.has(WikiServiceTokens.CollaborationService)).toBe(true);
      expect(container.has(WikiServiceTokens.PermissionService)).toBe(true);
      expect(container.has(WikiServiceTokens.LockService)).toBe(true);
      expect(container.has(WikiServiceTokens.ADRService)).toBe(true);
      expect(container.has(WikiServiceTokens.KnowledgeGraphService)).toBe(true);
    });

    it('should register services as singletons by default', () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      const storage1 = container.resolve(WikiServiceTokens.Storage);
      const storage2 = container.resolve(WikiServiceTokens.Storage);

      expect(storage1).toBe(storage2);
    });
  });

  describe('createWikiManager', () => {
    it('should create a WikiManager with all dependencies injected', async () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      const manager = await WikiServiceFactory.createWikiManager(container, '/test/project');

      expect(manager).toBeDefined();
      expect(manager.getProjectPath()).toBe('/test/project');
    });
  });

  describe('getStorage', () => {
    it('should resolve storage service', () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      const storage = WikiServiceFactory.getStorage();

      expect(storage).toBeDefined();
    });
  });

  describe('getHistory', () => {
    it('should resolve history service', () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      const history = WikiServiceFactory.getHistory();

      expect(history).toBeDefined();
    });
  });

  describe('getAudit', () => {
    it('should resolve audit service', () => {
      WikiServiceFactory.registerServices(container, '/test/project');

      const audit = WikiServiceFactory.getAudit();

      expect(audit).toBeDefined();
    });
  });
});
