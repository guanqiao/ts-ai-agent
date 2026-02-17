import {
  ILLMProvider,
  IAgent,
  IWikiManager,
  IWikiStorage,
  IParser,
  IGenerator,
  Language,
} from '@core/interfaces';

describe('Core Interfaces', () => {
  describe('ILLMProvider', () => {
    it('should define complete interface', () => {
      const mockProvider: ILLMProvider = {
        complete: jest.fn(),
        stream: jest.fn(),
        embed: jest.fn(),
        getModel: jest.fn(),
      };

      expect(typeof mockProvider.complete).toBe('function');
      expect(typeof mockProvider.stream).toBe('function');
      expect(typeof mockProvider.embed).toBe('function');
      expect(typeof mockProvider.getModel).toBe('function');
    });
  });

  describe('IAgent', () => {
    it('should define complete interface', () => {
      const mockAgent: IAgent = {
        name: 'TestAgent',
        execute: jest.fn(),
      };

      expect(mockAgent.name).toBe('TestAgent');
      expect(typeof mockAgent.execute).toBe('function');
    });
  });

  describe('IWikiManager', () => {
    it('should define complete interface', () => {
      const mockManager: IWikiManager = {
        initialize: jest.fn(),
        generate: jest.fn(),
        update: jest.fn(),
        query: jest.fn(),
        export: jest.fn(),
        watch: jest.fn(),
        stopWatching: jest.fn(),
        getPage: jest.fn(),
        listPages: jest.fn(),
        deletePage: jest.fn(),
      };

      expect(typeof mockManager.initialize).toBe('function');
      expect(typeof mockManager.generate).toBe('function');
      expect(typeof mockManager.update).toBe('function');
      expect(typeof mockManager.query).toBe('function');
      expect(typeof mockManager.export).toBe('function');
      expect(typeof mockManager.watch).toBe('function');
      expect(typeof mockManager.stopWatching).toBe('function');
      expect(typeof mockManager.getPage).toBe('function');
      expect(typeof mockManager.listPages).toBe('function');
      expect(typeof mockManager.deletePage).toBe('function');
    });
  });

  describe('IWikiStorage', () => {
    it('should define complete interface', () => {
      const mockStorage: IWikiStorage = {
        save: jest.fn(),
        load: jest.fn(),
        savePage: jest.fn(),
        loadPage: jest.fn(),
        deletePage: jest.fn(),
        listPages: jest.fn(),
        exists: jest.fn(),
      };

      expect(typeof mockStorage.save).toBe('function');
      expect(typeof mockStorage.load).toBe('function');
      expect(typeof mockStorage.savePage).toBe('function');
      expect(typeof mockStorage.loadPage).toBe('function');
      expect(typeof mockStorage.deletePage).toBe('function');
      expect(typeof mockStorage.listPages).toBe('function');
      expect(typeof mockStorage.exists).toBe('function');
    });
  });

  describe('IParser', () => {
    it('should define complete interface', () => {
      const mockParser: IParser = {
        language: Language.TypeScript,
        parse: jest.fn(),
        parseDirectory: jest.fn(),
        isSupported: jest.fn(),
      };

      expect(mockParser.language).toBe(Language.TypeScript);
      expect(typeof mockParser.parse).toBe('function');
      expect(typeof mockParser.parseDirectory).toBe('function');
      expect(typeof mockParser.isSupported).toBe('function');
    });
  });

  describe('IGenerator', () => {
    it('should define complete interface', () => {
      const mockGenerator: IGenerator = {
        generate: jest.fn(),
        getSupportedFormats: jest.fn(),
      };

      expect(typeof mockGenerator.generate).toBe('function');
      expect(typeof mockGenerator.getSupportedFormats).toBe('function');
    });
  });
});
