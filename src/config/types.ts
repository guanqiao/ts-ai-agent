import { DocumentFormat, Language } from '../types';
import { WikiLanguage } from '../wiki/types';

export interface WikiConfig {
  version: string;
  project: ProjectConfig;
  wiki: WikiGenerationConfig;
  sync: SyncConfig;
  search: SearchConfig;
  llm: LLMConfigOptions;
  notifications: NotificationConfig;
}

export interface ProjectConfig {
  name: string;
  path: string;
  language: Language;
  excludePatterns: string[];
  includePatterns: string[];
}

export interface WikiGenerationConfig {
  outputDir: string;
  format: DocumentFormat;
  generateIndex: boolean;
  generateSearch: boolean;
  includePrivate: boolean;
  categories: string[];
  customTemplates: Record<string, string>;
  wikiLanguages?: WikiLanguage[];
}

export interface SyncConfig {
  autoSync: boolean;
  syncOnOpen: boolean;
  syncOnGitChange: boolean;
  debounceMs: number;
  backgroundMode: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface SearchConfig {
  enabled: boolean;
  type: 'keyword' | 'semantic' | 'hybrid';
  keywordWeight: number;
  semanticWeight: number;
  maxResults: number;
  threshold: number;
  includeHighlights: boolean;
}

export interface LLMConfigOptions {
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl?: string;
  embeddingModel?: string;
  caCert?: string;
}

export interface NotificationConfig {
  enabled: boolean;
  onOutdated: boolean;
  onSyncComplete: boolean;
  onError: boolean;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'console' | 'file' | 'webhook' | 'email';
  config: Record<string, unknown>;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export interface ConfigError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ConfigWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ConfigDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IConfigManager {
  load(): Promise<WikiConfig>;
  save(config: WikiConfig): Promise<void>;
  get<K extends keyof WikiConfig>(key: K): Promise<WikiConfig[K]>;
  set<K extends keyof WikiConfig>(key: K, value: WikiConfig[K]): Promise<void>;
  reset(): Promise<void>;
  validate(config: WikiConfig): Promise<ConfigValidationResult>;
  diff(oldConfig: WikiConfig, newConfig: WikiConfig): ConfigDiff[];
}

export interface ConfigMigration {
  version: string;
  migrate(config: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface ConfigTemplate {
  name: string;
  description: string;
  config: Partial<WikiConfig>;
}

export const DEFAULT_CONFIG: WikiConfig = {
  version: '1.0.0',
  project: {
    name: '',
    path: '',
    language: Language.TypeScript,
    excludePatterns: ['node_modules', 'dist', 'build', '.git', '**/*.test.ts', '**/*.spec.ts'],
    includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  },
  wiki: {
    outputDir: '.wiki',
    format: DocumentFormat.Markdown,
    generateIndex: true,
    generateSearch: true,
    includePrivate: false,
    categories: ['overview', 'architecture', 'api', 'module', 'guide'],
    customTemplates: {},
    wikiLanguages: [WikiLanguage.English],
  },
  sync: {
    autoSync: true,
    syncOnOpen: true,
    syncOnGitChange: true,
    debounceMs: 2000,
    backgroundMode: true,
    maxRetries: 3,
    retryDelayMs: 1000,
  },
  search: {
    enabled: true,
    type: 'hybrid',
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    maxResults: 10,
    threshold: 0.5,
    includeHighlights: true,
  },
  llm: {
    enabled: true,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    embeddingModel: 'text-embedding-ada-002',
  },
  notifications: {
    enabled: true,
    onOutdated: true,
    onSyncComplete: false,
    onError: true,
    channels: [{ type: 'console', config: {} }],
  },
};
