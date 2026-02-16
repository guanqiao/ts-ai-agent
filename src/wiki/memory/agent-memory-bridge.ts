import { LLMService } from '../../llm';
import { WikiSearchMemory } from './wiki-search-memory';
import { KnowledgeCache } from './knowledge-cache';
import {
  MemoryEntry,
  MemoryEntryType,
  MemoryContext,
  IAgentMemoryBridge,
} from './types';

export class AgentMemoryBridge implements IAgentMemoryBridge {
  private memoryService: WikiSearchMemory;
  private cache: KnowledgeCache;
  private maxContextTokens: number;

  constructor(
    memoryService: WikiSearchMemory,
    cache: KnowledgeCache,
    _llmService?: LLMService,
    maxContextTokens: number = 4000
  ) {
    this.memoryService = memoryService;
    this.cache = cache;
    this.maxContextTokens = maxContextTokens;
  }

  async provideContext(query: string, maxTokens?: number): Promise<MemoryContext> {
    const tokens = maxTokens || this.maxContextTokens;

    const cacheKey = `context:${this.hashQuery(query)}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return {
        entries: [cached],
        summary: cached.content,
        totalTokens: this.estimateTokens(cached.content),
        relevanceScore: cached.metadata.relevance,
      };
    }

    const context = await this.memoryService.getContextForAgent(query, tokens);

    if (context.entries.length > 0) {
      const summaryEntry: MemoryEntry = {
        id: `context-${Date.now()}`,
        type: MemoryEntryType.Documentation,
        content: context.summary,
        metadata: {
          source: 'agent-context',
          tags: ['context', 'summary'],
          relevance: context.relevanceScore,
          confidence: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      await this.cache.cache(cacheKey, summaryEntry, 60 * 60 * 1000);
    }

    return context;
  }

  async enrichPrompt(prompt: string, context?: MemoryContext): Promise<string> {
    const memoryContext = context || await this.provideContext(prompt);

    if (memoryContext.entries.length === 0) {
      return prompt;
    }

    const contextSection = this.formatContextForPrompt(memoryContext);

    const enrichedPrompt = `## Relevant Context

${contextSection}

## Task

${prompt}`;

    return enrichedPrompt;
  }

  async storeKnowledge(
    content: string,
    type: MemoryEntryType,
    metadata?: Partial<{
      source: string;
      pageId: string;
      filePath: string;
      symbolName: string;
      tags: string[];
      relevance: number;
      confidence: number;
    }>
  ): Promise<MemoryEntry> {
    const entry = await this.memoryService.storeKnowledge(content, type, metadata);

    const cacheKey = `${type}:${metadata?.filePath || metadata?.symbolName || entry.id}`;
    await this.cache.cache(cacheKey, entry);

    return entry;
  }

  async getRelevantSymbols(symbolName: string): Promise<MemoryEntry[]> {
    const cacheKey = `symbol:${symbolName}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return [cached];
    }

    const entries = await this.memoryService.getRelevant(symbolName, 5);

    const symbolEntries = entries.filter(
      (e) =>
        e.metadata.symbolName === symbolName ||
        e.content.toLowerCase().includes(symbolName.toLowerCase())
    );

    return symbolEntries;
  }

  async getRelevantFiles(filePath: string): Promise<MemoryEntry[]> {
    const cacheKey = `file:${filePath}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return [cached];
    }

    const results = await this.memoryService.query({
      text: filePath,
      filePath,
      limit: 10,
    });

    return results.map((r) => r.entry);
  }

  async getArchitectureContext(): Promise<MemoryContext> {
    return this.provideContext('architecture pattern layers modules');
  }

  async getAPIContext(symbolName?: string): Promise<MemoryContext> {
    const query = symbolName
      ? `API ${symbolName} function method class interface`
      : 'API reference functions methods classes interfaces';
    return this.provideContext(query);
  }

  async getModuleContext(moduleName: string): Promise<MemoryContext> {
    return this.provideContext(`module ${moduleName} components services types`);
  }

  async getDecisionContext(topic?: string): Promise<MemoryContext> {
    const query = topic
      ? `decision ${topic} ADR architecture choice`
      : 'architecture decision record ADR';
    return this.provideContext(query);
  }

  async invalidateFileContext(filePath: string): Promise<void> {
    await this.cache.invalidatePattern(`file:${filePath}`);
    await this.memoryService.invalidate({ filePath });
  }

  async invalidateSymbolContext(symbolName: string): Promise<void> {
    await this.cache.invalidatePattern(`symbol:${symbolName}`);
    await this.memoryService.invalidate({ symbolName });
  }

  setLLMService(llmService: LLMService): void {
    this.memoryService.setLLMService(llmService);
  }

  private formatContextForPrompt(context: MemoryContext): string {
    const sections: string[] = [];

    for (const entry of context.entries.slice(0, 5)) {
      const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      const source = entry.metadata.filePath || entry.metadata.pageId || 'project';

      sections.push(`### ${typeLabel} (${source})\n\n${entry.content.slice(0, 500)}${entry.content.length > 500 ? '...' : ''}`);
    }

    if (context.summary) {
      sections.unshift(`**Summary:** ${context.summary}`);
    }

    return sections.join('\n\n');
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
