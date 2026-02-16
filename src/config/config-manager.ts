import * as path from 'path';
import * as fs from 'fs';
import {
  IConfigManager,
  WikiConfig,
  ConfigValidationResult,
  ConfigError,
  ConfigWarning,
  ConfigDiff,
  DEFAULT_CONFIG,
} from './types';

export class ConfigManager implements IConfigManager {
  private projectPath: string;
  private configPath: string;
  private config: WikiConfig | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, '.wiki', 'config.json');
  }

  async load(): Promise<WikiConfig> {
    if (this.config) {
      return this.config;
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        this.config = this.mergeWithDefaults(loaded);
        return this.config;
      } catch {
        this.config = { ...DEFAULT_CONFIG };
        return this.config;
      }
    }

    this.config = { ...DEFAULT_CONFIG };
    return this.config;
  }

  async save(config: WikiConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const validation = await this.validate(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    this.config = config;
  }

  async get<K extends keyof WikiConfig>(key: K): Promise<WikiConfig[K]> {
    const config = await this.load();
    return config[key];
  }

  async set<K extends keyof WikiConfig>(key: K, value: WikiConfig[K]): Promise<void> {
    const config = await this.load();
    config[key] = value;
    await this.save(config);
  }

  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save(this.config);
  }

  async validate(config: WikiConfig): Promise<ConfigValidationResult> {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];

    if (!config.version) {
      errors.push({ field: 'version', message: 'Version is required' });
    }

    if (!config.project?.name) {
      errors.push({ field: 'project.name', message: 'Project name is required' });
    }

    if (!config.project?.path) {
      errors.push({ field: 'project.path', message: 'Project path is required' });
    }

    if (config.wiki?.outputDir) {
      if (config.wiki.outputDir.startsWith('/')) {
        warnings.push({
          field: 'wiki.outputDir',
          message: 'Absolute path for output directory may cause issues',
          suggestion: 'Use a relative path instead',
        });
      }
    }

    if (config.search) {
      if (config.search.keywordWeight + config.search.semanticWeight !== 1) {
        warnings.push({
          field: 'search.keywordWeight + search.semanticWeight',
          message: 'Keyword and semantic weights should sum to 1',
          suggestion: 'Adjust weights so they sum to 1',
        });
      }

      if (config.search.threshold < 0 || config.search.threshold > 1) {
        errors.push({
          field: 'search.threshold',
          message: 'Search threshold must be between 0 and 1',
          value: config.search.threshold,
        });
      }
    }

    if (config.llm) {
      if (config.llm.temperature < 0 || config.llm.temperature > 2) {
        warnings.push({
          field: 'llm.temperature',
          message: 'Temperature should typically be between 0 and 2',
          suggestion: 'Use a value between 0 and 2',
        });
      }

      if (config.llm.maxTokens < 1) {
        errors.push({
          field: 'llm.maxTokens',
          message: 'Max tokens must be at least 1',
          value: config.llm.maxTokens,
        });
      }
    }

    if (config.sync) {
      if (config.sync.debounceMs < 0) {
        errors.push({
          field: 'sync.debounceMs',
          message: 'Debounce time cannot be negative',
          value: config.sync.debounceMs,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  diff(oldConfig: WikiConfig, newConfig: WikiConfig): ConfigDiff[] {
    const diffs: ConfigDiff[] = [];
    this.diffObjects('', oldConfig, newConfig, diffs);
    return diffs;
  }

  private diffObjects(prefix: string, oldObj: unknown, newObj: unknown, diffs: ConfigDiff[]): void {
    if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
      if (oldObj !== newObj) {
        diffs.push({
          field: prefix,
          oldValue: oldObj,
          newValue: newObj,
        });
      }
      return;
    }

    if (oldObj === null || newObj === null) {
      if (oldObj !== newObj) {
        diffs.push({
          field: prefix,
          oldValue: oldObj,
          newValue: newObj,
        });
      }
      return;
    }

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const field = prefix ? `${prefix}.${key}` : key;
      const oldVal = (oldObj as Record<string, unknown>)[key];
      const newVal = (newObj as Record<string, unknown>)[key];

      if (oldVal === undefined && newVal !== undefined) {
        diffs.push({ field, oldValue: undefined, newValue: newVal });
      } else if (oldVal !== undefined && newVal === undefined) {
        diffs.push({ field, oldValue: oldVal, newValue: undefined });
      } else if (typeof oldVal === 'object' && typeof newVal === 'object') {
        this.diffObjects(field, oldVal, newVal, diffs);
      } else if (oldVal !== newVal) {
        diffs.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }
  }

  private mergeWithDefaults(loaded: Partial<WikiConfig>): WikiConfig {
    return {
      ...DEFAULT_CONFIG,
      ...loaded,
      project: { ...DEFAULT_CONFIG.project, ...loaded.project },
      wiki: { ...DEFAULT_CONFIG.wiki, ...loaded.wiki },
      sync: { ...DEFAULT_CONFIG.sync, ...loaded.sync },
      search: { ...DEFAULT_CONFIG.search, ...loaded.search },
      llm: { ...DEFAULT_CONFIG.llm, ...loaded.llm },
      notifications: { ...DEFAULT_CONFIG.notifications, ...loaded.notifications },
    };
  }

  getConfigPath(): string {
    return this.configPath;
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  async updatePartial(partial: Partial<WikiConfig>): Promise<void> {
    const config = await this.load();
    const updated = this.mergeWithDefaults({ ...config, ...partial });
    await this.save(updated);
  }

  async getProjectName(): Promise<string> {
    const config = await this.load();
    return config.project.name || path.basename(this.projectPath);
  }

  async setProjectName(name: string): Promise<void> {
    await this.updatePartial({ project: { ...(await this.load()).project, name } });
  }
}
