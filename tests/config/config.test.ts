import { ConfigManager } from '../../src/config/config-manager';
import { DEFAULT_CONFIG, WikiConfig, ConfigValidationResult } from '../../src/config/types';
import * as fs from 'fs';
import { DocumentFormat } from '../../src/types';

jest.mock('fs');
jest.mock('path');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager(mockProjectPath);
  });

  describe('constructor', () => {
    it('should create ConfigManager with project path', () => {
      expect(configManager).toBeDefined();
    });
  });

  describe('load', () => {
    it('should load config from file', async () => {
      const mockConfig: WikiConfig = {
        ...DEFAULT_CONFIG,
        project: {
          ...DEFAULT_CONFIG.project,
          name: 'test-project',
        },
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const config = await configManager.load();

      expect(config.project.name).toBe('test-project');
    });

    it('should return default config if file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = await configManager.load();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should handle invalid JSON', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      const config = await configManager.load();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge with defaults', async () => {
      const partialConfig = {
        project: {
          name: 'custom-project',
        },
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(partialConfig));

      const config = await configManager.load();

      expect(config.project.name).toBe('custom-project');
      expect(config.version).toBe(DEFAULT_CONFIG.version);
    });
  });

  describe('save', () => {
    it('should save config to file', async () => {
      const config: WikiConfig = {
        ...DEFAULT_CONFIG,
        project: {
          ...DEFAULT_CONFIG.project,
          name: 'test-project',
          path: '/test/project',
        },
      };

      await configManager.save(config);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should validate valid config', async () => {
      const config: WikiConfig = {
        ...DEFAULT_CONFIG,
        project: {
          ...DEFAULT_CONFIG.project,
          name: 'test-project',
          path: '/test/project',
        },
      };

      const result = await configManager.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid language', async () => {
      const config: WikiConfig = {
        ...DEFAULT_CONFIG,
        project: {
          ...DEFAULT_CONFIG.project,
          language: 'invalid-language' as any,
        },
      };

      const result = await configManager.validate(config);

      expect(result.valid).toBe(false);
    });

    it('should detect invalid temperature', async () => {
      const config: WikiConfig = {
        ...DEFAULT_CONFIG,
        llm: {
          ...DEFAULT_CONFIG.llm,
          temperature: 3,
        },
      };

      const result = await configManager.validate(config);

      expect(result.valid).toBe(false);
    });

    it('should detect invalid maxTokens', async () => {
      const config: WikiConfig = {
        ...DEFAULT_CONFIG,
        llm: {
          ...DEFAULT_CONFIG.llm,
          maxTokens: -100,
        },
      };

      const result = await configManager.validate(config);

      expect(result.valid).toBe(false);
    });
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should have all required properties', () => {
    expect(DEFAULT_CONFIG.version).toBeDefined();
    expect(DEFAULT_CONFIG.project).toBeDefined();
    expect(DEFAULT_CONFIG.wiki).toBeDefined();
    expect(DEFAULT_CONFIG.sync).toBeDefined();
    expect(DEFAULT_CONFIG.search).toBeDefined();
    expect(DEFAULT_CONFIG.llm).toBeDefined();
    expect(DEFAULT_CONFIG.notifications).toBeDefined();
  });

  it('should have valid default values', () => {
    expect(DEFAULT_CONFIG.wiki.format).toBe(DocumentFormat.Markdown);
    expect(DEFAULT_CONFIG.wiki.generateIndex).toBe(true);
    expect(DEFAULT_CONFIG.wiki.generateSearch).toBe(true);
    expect(DEFAULT_CONFIG.sync.autoSync).toBe(true);
  });

  it('should have valid LLM defaults', () => {
    expect(DEFAULT_CONFIG.llm.enabled).toBe(true);
    expect(DEFAULT_CONFIG.llm.model).toBe('gpt-4');
    expect(DEFAULT_CONFIG.llm.temperature).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.llm.temperature).toBeLessThanOrEqual(1);
  });
});

describe('WikiConfig', () => {
  it('should allow partial config', () => {
    const partialConfig: Partial<WikiConfig> = {
      version: '1.0.0',
    };

    expect(partialConfig.version).toBe('1.0.0');
  });

  it('should have correct project config structure', () => {
    const projectConfig = DEFAULT_CONFIG.project;

    expect(projectConfig.name).toBeDefined();
    expect(projectConfig.path).toBeDefined();
    expect(projectConfig.language).toBeDefined();
    expect(Array.isArray(projectConfig.excludePatterns)).toBe(true);
    expect(Array.isArray(projectConfig.includePatterns)).toBe(true);
  });

  it('should have correct wiki config structure', () => {
    const wikiConfig = DEFAULT_CONFIG.wiki;

    expect(wikiConfig.outputDir).toBeDefined();
    expect(wikiConfig.format).toBeDefined();
    expect(typeof wikiConfig.generateIndex).toBe('boolean');
    expect(typeof wikiConfig.generateSearch).toBe('boolean');
  });

  it('should have correct sync config structure', () => {
    const syncConfig = DEFAULT_CONFIG.sync;

    expect(typeof syncConfig.autoSync).toBe('boolean');
    expect(typeof syncConfig.debounceMs).toBe('number');
    expect(typeof syncConfig.maxRetries).toBe('number');
  });

  it('should have correct search config structure', () => {
    const searchConfig = DEFAULT_CONFIG.search;

    expect(typeof searchConfig.enabled).toBe('boolean');
    expect(['keyword', 'semantic', 'hybrid']).toContain(searchConfig.type);
    expect(typeof searchConfig.maxResults).toBe('number');
    expect(typeof searchConfig.threshold).toBe('number');
  });
});

describe('ConfigValidationResult', () => {
  it('should have correct structure', () => {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    expect(result.valid).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
