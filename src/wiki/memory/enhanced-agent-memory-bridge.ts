import { WikiSearchMemory } from './wiki-search-memory';
import { KnowledgeCache } from './knowledge-cache';
import { MemoryEntry, MemoryEntryType, MemoryContext, MemoryMetadata } from './types';
import { SearchMemoryTool } from '../tools/search-memory-tool';

export interface TaskContext {
  taskType: 'refactoring' | 'feature' | 'bugfix' | 'architecture' | 'documentation' | 'general';
  primarySymbols?: string[];
  primaryFiles?: string[];
  keywords?: string[];
}

export class EnhancedAgentMemoryBridge {
  private memoryService: WikiSearchMemory;
  private cache: KnowledgeCache;
  private searchTool: SearchMemoryTool;
  private maxContextTokens: number = 4000;

  constructor(
    memoryService: WikiSearchMemory,
    cache: KnowledgeCache,
    searchTool: SearchMemoryTool
  ) {
    this.memoryService = memoryService;
    this.cache = cache;
    this.searchTool = searchTool;
  }

  async provideContext(query: string, maxTokens?: number): Promise<MemoryContext> {
    const tokens = maxTokens || this.maxContextTokens;

    const cacheKey = `enhanced-context:${this.hashQuery(query)}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return {
        entries: [cached],
        summary: cached.content,
        totalTokens: this.estimateTokens(cached.content),
        relevanceScore: cached.metadata.relevance,
      };
    }

    const context = await this.searchTool.provideContext(query, tokens);

    if (!context || !context.entries) {
      return {
        entries: [],
        summary: 'No context available',
        totalTokens: 0,
        relevanceScore: 0,
      };
    }

    const sortedEntries = [...context.entries].sort(
      (a, b) => b.metadata.relevance - a.metadata.relevance
    );

    return {
      ...context,
      entries: sortedEntries,
    };
  }

  async enrichPrompt(prompt: string, context?: MemoryContext): Promise<string> {
    return this.searchTool.enrichPrompt(prompt, context);
  }

  async storeKnowledge(
    content: string,
    type: MemoryEntryType,
    metadata?: Partial<MemoryMetadata>
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

  async getMultiDimensionalContext(
    query: string,
    types: MemoryEntryType[]
  ): Promise<MemoryContext> {
    const allEntries: MemoryEntry[] = [];
    let totalTokens = 0;

    for (const type of types) {
      const results = await this.memoryService.query({
        text: query,
        types: [type],
        limit: 3,
      });

      if (results && Array.isArray(results)) {
        for (const result of results) {
          if (totalTokens + this.estimateTokens(result.entry.content) <= this.maxContextTokens) {
            allEntries.push(result.entry);
            totalTokens += this.estimateTokens(result.entry.content);
          }
        }
      }
    }

    const summary = this.generateMultiDimensionalSummary(allEntries, types);

    return {
      entries: allEntries,
      summary,
      totalTokens,
      relevanceScore: this.calculateAverageRelevance(allEntries),
    };
  }

  async getArchitectureContext(): Promise<MemoryContext> {
    return this.searchTool.provideContext('architecture pattern layers modules');
  }

  async getAPIContext(symbolName?: string): Promise<MemoryContext> {
    const query = symbolName
      ? `API ${symbolName} function method class interface`
      : 'API reference functions methods classes interfaces';

    return this.searchTool.provideContext(query);
  }

  async provideContextForTask(taskDescription: string, taskType: string): Promise<MemoryContext> {
    const typePriorities = this.getTypePriorities(taskType);
    const keywords = this.extractKeywords(taskDescription);

    const query = `${typePriorities.primaryTypes.join(' ')} ${keywords.join(' ')}`;

    const context = await this.searchTool.provideContext(query, this.maxContextTokens);

    if (typePriorities.secondaryTypes.length > 0) {
      const secondaryContext = await this.getMultiDimensionalContext(
        taskDescription,
        typePriorities.secondaryTypes
      );

      context.entries = [...context.entries, ...secondaryContext.entries].slice(0, 10);
      context.totalTokens = this.estimateTotalTokens(context.entries);
    }

    return context;
  }

  private getTypePriorities(taskType: string): {
    primaryTypes: MemoryEntryType[];
    secondaryTypes: MemoryEntryType[];
  } {
    switch (taskType) {
      case 'refactoring':
        return {
          primaryTypes: [MemoryEntryType.Code, MemoryEntryType.Pattern],
          secondaryTypes: [MemoryEntryType.Architecture, MemoryEntryType.Decision],
        };
      case 'feature':
        return {
          primaryTypes: [MemoryEntryType.Module, MemoryEntryType.API],
          secondaryTypes: [MemoryEntryType.Architecture, MemoryEntryType.Pattern],
        };
      case 'bugfix':
        return {
          primaryTypes: [MemoryEntryType.Code, MemoryEntryType.API],
          secondaryTypes: [MemoryEntryType.Pattern],
        };
      case 'architecture':
        return {
          primaryTypes: [MemoryEntryType.Architecture, MemoryEntryType.Decision],
          secondaryTypes: [MemoryEntryType.Module, MemoryEntryType.Pattern],
        };
      case 'documentation':
        return {
          primaryTypes: [MemoryEntryType.Documentation, MemoryEntryType.API],
          secondaryTypes: [MemoryEntryType.Module],
        };
      default:
        return {
          primaryTypes: [MemoryEntryType.Documentation],
          secondaryTypes: [MemoryEntryType.Architecture, MemoryEntryType.API],
        };
    }
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)].slice(0, 10);
  }

  private generateMultiDimensionalSummary(
    entries: MemoryEntry[],
    types: MemoryEntryType[]
  ): string {
    if (entries.length === 0) {
      return 'No relevant information found.';
    }

    const typeGroups = new Map<MemoryEntryType, MemoryEntry[]>();

    for (const entry of entries) {
      const existing = typeGroups.get(entry.type) || [];
      existing.push(entry);
      typeGroups.set(entry.type, existing);
    }

    const parts: string[] = [];

    for (const type of types) {
      const typeEntries = typeGroups.get(type);
      if (typeEntries && typeEntries.length > 0) {
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        parts.push(
          `${typeLabel}: ${typeEntries.map((e) => e.content.substring(0, 100)).join('; ')}`
        );
      }
    }

    return parts.join('\n');
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateTotalTokens(entries: MemoryEntry[]): number {
    return entries.reduce((total, entry) => total + this.estimateTokens(entry.content), 0);
  }

  private calculateAverageRelevance(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;

    const totalRelevance = entries.reduce((sum, entry) => sum + entry.metadata.relevance, 0);
    return totalRelevance / entries.length;
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
