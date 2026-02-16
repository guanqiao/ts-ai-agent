import { BaseTool } from '../../agents/tools/base-tool';
import { ToolContext, ToolResult, ToolParameter } from '../../agents/tools/types';
import { WikiSearchMemory } from '../memory/wiki-search-memory';
import { KnowledgeCache } from '../memory/knowledge-cache';
import { MemoryEntry, MemoryEntryType, MemoryContext } from '../memory/types';

export interface SearchMemoryResult {
  entries: MemoryEntry[];
  summary: string;
  totalTokens: number;
  relevanceScore: number;
}

export class SearchMemoryTool extends BaseTool {
  readonly name = 'search_memory';
  readonly description =
    'Search the project wiki knowledge base for relevant information. Use this tool to find architecture decisions, API documentation, module descriptions, and coding patterns.';
  readonly parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: 'The search query to find relevant information in the wiki',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      description: 'Optional filter by memory type (architecture, api, module, decision, pattern)',
      required: false,
      enum: ['architecture', 'api', 'module', 'decision', 'pattern', 'code', 'documentation'],
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      defaultValue: 5,
    },
  ];

  private memoryService: WikiSearchMemory;
  private cache: KnowledgeCache;
  private defaultMaxTokens: number = 4000;

  constructor(memoryService: WikiSearchMemory, cache: KnowledgeCache) {
    super();
    this.memoryService = memoryService;
    this.cache = cache;
  }

  async execute(context: ToolContext): Promise<ToolResult> {
    const validation = this.validateParameters(context.params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
      };
    }

    const query = context.params.query as string;
    const type = context.params.type as string | undefined;
    const limit = (context.params.limit as number) || 5;

    try {
      const cacheKey = this.getCacheKey(query, type, limit);
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        return {
          success: true,
          data: {
            entries: [cached],
            summary: cached.content,
            totalTokens: this.estimateTokens(cached.content),
            relevanceScore: cached.metadata.relevance,
            fromCache: true,
          },
        };
      }

      let entries: MemoryEntry[];

      if (type) {
        const results = await this.memoryService.query({
          text: query,
          types: [this.parseMemoryType(type)],
          limit,
        });
        entries = results.map((r) => r.entry);
      } else {
        entries = await this.memoryService.getRelevant(query, limit);
      }

      const summary = this.generateSummary(entries);
      const totalTokens = this.estimateTotalTokens(entries);

      const result: SearchMemoryResult = {
        entries,
        summary,
        totalTokens,
        relevanceScore: this.calculateAverageRelevance(entries),
      };

      if (entries.length > 0) {
        const summaryEntry: MemoryEntry = {
          id: `search-${Date.now()}`,
          type: MemoryEntryType.Documentation,
          content: summary,
          metadata: {
            source: 'search-memory-tool',
            tags: ['search-result', 'summary'],
            relevance: result.relevanceScore,
            confidence: 1,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 0,
        };

        await this.cache.cache(cacheKey, summaryEntry, 60 * 60 * 1000);
      }

      return {
        success: true,
        data: result,
        metadata: {
          resultCount: entries.length,
          fromCache: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async provideContext(query: string, maxTokens?: number): Promise<MemoryContext> {
    const tokens = maxTokens || this.defaultMaxTokens;

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
          source: 'search-memory-tool',
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
    const memoryContext = context || (await this.provideContext(prompt));

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

  private parseMemoryType(type: string): MemoryEntryType {
    const typeMap: Record<string, MemoryEntryType> = {
      architecture: MemoryEntryType.Architecture,
      api: MemoryEntryType.API,
      module: MemoryEntryType.Module,
      decision: MemoryEntryType.Decision,
      pattern: MemoryEntryType.Pattern,
      code: MemoryEntryType.Code,
      documentation: MemoryEntryType.Documentation,
    };

    return typeMap[type.toLowerCase()] || MemoryEntryType.Documentation;
  }

  private generateSummary(entries: MemoryEntry[]): string {
    if (entries.length === 0) {
      return 'No relevant information found in the wiki knowledge base.';
    }

    const summaries = entries.map((entry, index) => {
      const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      return `${index + 1}. [${typeLabel}] ${entry.content.substring(0, 200)}${entry.content.length > 200 ? '...' : ''}`;
    });

    return `Found ${entries.length} relevant items:\n\n${summaries.join('\n\n')}`;
  }

  private estimateTotalTokens(entries: MemoryEntry[]): number {
    return entries.reduce((total, entry) => total + this.estimateTokens(entry.content), 0);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private calculateAverageRelevance(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;

    const totalRelevance = entries.reduce((sum, entry) => sum + entry.metadata.relevance, 0);
    return totalRelevance / entries.length;
  }

  private formatContextForPrompt(context: MemoryContext): string {
    const lines: string[] = [];

    lines.push(`Summary: ${context.summary}`);
    lines.push('');
    lines.push('Details:');

    for (const entry of context.entries) {
      const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      lines.push(`- [${typeLabel}] ${entry.content}`);
    }

    return lines.join('\n');
  }

  private getCacheKey(query: string, type?: string, limit?: number): string {
    const parts = [query];
    if (type) parts.push(type);
    if (limit) parts.push(String(limit));
    return `search:${this.hashQuery(parts.join(':'))}`;
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
}
