export const APP_CONFIG = {
  version: '1.0.0',
  name: 'tsd-generator',
} as const;

export const WIKI_CONFIG = {
  similarityThreshold: 50,
  maxRelatedPages: 10,
  defaultOutputDir: './wiki',
  indexFileName: 'index.md',
  configFileName: 'config.json',
} as const;

export const QUALITY_CONFIG = {
  minCompleteness: 25,
  maxContentLength: 150,
  minCoherenceScore: 0.2,
  dimensions: {
    completeness: { weight: 0.25, threshold: 0.6 },
    accuracy: { weight: 0.25, threshold: 0.7 },
    coherence: { weight: 0.2, threshold: 0.5 },
    coverage: { weight: 0.15, threshold: 0.8 },
    freshness: { weight: 0.15, threshold: 0.5 },
  },
} as const;

export const UPDATE_CONFIG = {
  baseTimeMs: 100,
  batchSize: 20,
  maxBatchSize: 50,
  debounceMs: 300,
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;

export const KNOWLEDGE_CONFIG = {
  maxIterations: 10,
  similarityThreshold: 0.7,
  clusteringThreshold: 0.5,
  maxEdges: 100,
} as const;

export const SYNC_CONFIG = {
  defaultIntervalMs: 60000,
  maxPendingChanges: 100,
  conflictThreshold: 10,
} as const;

export const LLM_CONFIG = {
  defaultModel: 'gpt-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  cacheEnabled: true,
  cacheTTL: 3600000,
} as const;

export const PARSER_CONFIG = {
  maxFileSize: 1024 * 1024,
  supportedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.java'],
  excludePatterns: ['node_modules', 'dist', 'build', '.git'],
} as const;

export const LOG_CONFIG = {
  defaultLevel: 'INFO',
  timestampEnabled: true,
  colorizeEnabled: true,
} as const;

export function getConfigValue<T>(path: string, defaultValue: T): T {
  const parts = path.split('.');
  let current: unknown = { APP_CONFIG, WIKI_CONFIG, QUALITY_CONFIG, UPDATE_CONFIG, KNOWLEDGE_CONFIG, SYNC_CONFIG, LLM_CONFIG, PARSER_CONFIG, LOG_CONFIG };

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}
