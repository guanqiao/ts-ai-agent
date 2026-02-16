export {
  MemoryEntry,
  MemoryEntryType,
  MemoryQuery,
  MemoryResult,
  MemoryContext,
  MemoryHighlight,
  MemoryMetadata,
  IMemoryService,
  IKnowledgeCache,
  IAgentMemoryBridge,
  MemoryStoreConfig,
  DEFAULT_MEMORY_CONFIG,
  MemoryIndex,
  CacheStats,
} from './types';

export { WikiSearchMemory } from './wiki-search-memory';
export { KnowledgeCache } from './knowledge-cache';
export { AgentMemoryBridge } from './agent-memory-bridge';
export { EnhancedAgentMemoryBridge, TaskContext } from './enhanced-agent-memory-bridge';
export { InteractionHistory } from './interaction-history';
export {
  InteractionType,
  InteractionRecord,
  InteractionMetadata,
  InteractionQuery,
  InteractionStats,
  InteractionHistoryConfig,
} from './interaction-types';
export { KnowledgeEvolution } from './knowledge-evolution';
export type {
  KnowledgeUpdateOptions,
  CleanupOptions,
  BoostOptions,
  EvolutionResult,
  KnowledgeUpdateResult,
  CleanupResult,
  ConsolidationResult,
  BoostResult,
} from './knowledge-evolution';
