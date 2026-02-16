import * as crypto from 'crypto';
import { LLMService } from '../../llm';
import { WikiDocument, WikiPage } from '../types';
import {
  MemoryEntry,
  MemoryEntryType,
  MemoryQuery,
  MemoryResult,
  MemoryContext,
  MemoryHighlight,
  IMemoryService,
  MemoryStoreConfig,
  DEFAULT_MEMORY_CONFIG,
  MemoryIndex,
} from './types';

export class WikiSearchMemory implements IMemoryService {
  private entries: Map<string, MemoryEntry> = new Map();
  private index: MemoryIndex;
  private llmService: LLMService | null = null;
  private config: MemoryStoreConfig;

  constructor(llmService?: LLMService, config?: Partial<MemoryStoreConfig>) {
    this.llmService = llmService || null;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.index = this.createEmptyIndex();
  }

  async storeKnowledge(
    content: string,
    type: MemoryEntryType,
    metadata?: Partial<{ source: string; pageId: string; filePath: string; symbolName: string; tags: string[]; relevance: number; confidence: number }>
  ): Promise<MemoryEntry> {
    const entry = await this.store({
      type,
      content,
      metadata: {
        source: metadata?.source || 'unknown',
        pageId: metadata?.pageId,
        filePath: metadata?.filePath,
        symbolName: metadata?.symbolName,
        tags: metadata?.tags || [],
        relevance: metadata?.relevance || 1,
        confidence: metadata?.confidence || 1,
      },
    });
    return entry;
  }

  async queryKnowledge(query: string, types?: MemoryEntryType[], limit?: number): Promise<MemoryResult[]> {
    return this.query({
      text: query,
      types,
      limit: limit || 10,
    });
  }

  async getContextForAgent(query: string, maxTokens: number = 4000): Promise<MemoryContext> {
    const results = await this.query({
      text: query,
      limit: 20,
      threshold: 0.3,
    });

    const entries: MemoryEntry[] = [];
    let totalTokens = 0;
    let relevanceScore = 0;

    for (const result of results) {
      const entryTokens = this.estimateTokens(result.entry.content);
      if (totalTokens + entryTokens <= maxTokens) {
        entries.push(result.entry);
        totalTokens += entryTokens;
        relevanceScore += result.score;
      }
    }

    const summary = await this.generateSummary(entries, query);

    return {
      entries,
      summary,
      totalTokens,
      relevanceScore: entries.length > 0 ? relevanceScore / entries.length : 0,
    };
  }

  async indexDocument(document: WikiDocument): Promise<void> {
    for (const page of document.pages) {
      await this.indexPage(page);
    }
  }

  async indexPage(page: WikiPage): Promise<void> {
    await this.store({
      type: MemoryEntryType.Documentation,
      content: page.content,
      metadata: {
        source: 'wiki',
        pageId: page.id,
        tags: page.metadata.tags,
        relevance: 1,
        confidence: 1,
      },
    });

    for (const section of page.sections) {
      await this.store({
        type: MemoryEntryType.Documentation,
        content: section.content,
        metadata: {
          source: 'wiki-section',
          pageId: page.id,
          tags: [section.title.toLowerCase()],
          relevance: 0.8,
          confidence: 1,
        },
      });
    }
  }

  async store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>): Promise<MemoryEntry> {
    const id = this.generateId();
    const now = new Date();

    const newEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    if (this.llmService && this.config.enableEmbeddings) {
      try {
        newEntry.embedding = await this.llmService.createEmbedding(entry.content);
      } catch {
        // Continue without embedding
      }
    }

    this.entries.set(id, newEntry);
    this.updateIndex(newEntry, 'add');

    if (this.entries.size > this.config.maxEntries) {
      await this.evictOldest();
    }

    return newEntry;
  }

  async query(query: MemoryQuery): Promise<MemoryResult[]> {
    const candidateIds = this.getCandidateIds(query);
    const results: MemoryResult[] = [];

    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      if (query.types && !query.types.includes(entry.type)) continue;
      if (!query.includeExpired && entry.expiresAt && entry.expiresAt < new Date()) continue;

      const score = this.calculateRelevance(entry, query);
      if (query.threshold && score < query.threshold) continue;

      entry.accessCount++;
      entry.lastAccessedAt = new Date();

      results.push({
        entry,
        score,
        highlights: this.generateHighlights(entry, query),
      });
    }

    results.sort((a, b) => b.score - a.score);

    const limit = query.limit || 10;
    return results.slice(0, limit);
  }

  async invalidate(filter: Partial<MemoryQuery>): Promise<number> {
    let count = 0;

    for (const [id, entry] of this.entries) {
      let matches = true;

      if (filter.types && !filter.types.includes(entry.type)) matches = false;
      if (filter.filePath && entry.metadata.filePath !== filter.filePath) matches = false;
      if (filter.symbolName && entry.metadata.symbolName !== filter.symbolName) matches = false;
      if (filter.tags && !filter.tags.some((t) => entry.metadata.tags.includes(t))) matches = false;

      if (matches) {
        this.updateIndex(entry, 'remove');
        this.entries.delete(id);
        count++;
      }
    }

    return count;
  }

  async getRelevant(context: string, limit: number = 10): Promise<MemoryEntry[]> {
    const results = await this.query({ text: context, limit });
    return results.map((r) => r.entry);
  }

  async getById(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) || null;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    const updatedEntry: MemoryEntry = {
      ...entry,
      ...updates,
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: new Date(),
    };

    this.entries.set(id, updatedEntry);
    this.updateIndex(entry, 'remove');
    this.updateIndex(updatedEntry, 'add');

    return updatedEntry;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.updateIndex(entry, 'remove');
    return this.entries.delete(id);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.index = this.createEmptyIndex();
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  private createEmptyIndex(): MemoryIndex {
    return {
      byType: new Map(),
      byTag: new Map(),
      byFile: new Map(),
      bySymbol: new Map(),
      byPage: new Map(),
    };
  }

  private updateIndex(entry: MemoryEntry, operation: 'add' | 'remove'): void {
    const updateMap = (map: Map<string, Set<string>>, key: string) => {
      if (!map.has(key)) map.set(key, new Set());
      if (operation === 'add') {
        map.get(key)!.add(entry.id);
      } else {
        map.get(key)!.delete(entry.id);
      }
    };

    updateMap(this.index.byType, entry.type);

    for (const tag of entry.metadata.tags) {
      updateMap(this.index.byTag, tag);
    }

    if (entry.metadata.filePath) {
      updateMap(this.index.byFile, entry.metadata.filePath);
    }

    if (entry.metadata.symbolName) {
      updateMap(this.index.bySymbol, entry.metadata.symbolName);
    }

    if (entry.metadata.pageId) {
      updateMap(this.index.byPage, entry.metadata.pageId);
    }
  }

  private getCandidateIds(query: MemoryQuery): Set<string> {
    const candidates = new Set<string>();

    if (query.filePath) {
      const fileIds = this.index.byFile.get(query.filePath);
      if (fileIds) fileIds.forEach((id) => candidates.add(id));
    }

    if (query.symbolName) {
      const symbolIds = this.index.bySymbol.get(query.symbolName);
      if (symbolIds) symbolIds.forEach((id) => candidates.add(id));
    }

    if (query.tags) {
      for (const tag of query.tags) {
        const tagIds = this.index.byTag.get(tag);
        if (tagIds) tagIds.forEach((id) => candidates.add(id));
      }
    }

    if (candidates.size === 0) {
      this.entries.forEach((_, id) => candidates.add(id));
    }

    return candidates;
  }

  private calculateRelevance(entry: MemoryEntry, query: MemoryQuery): number {
    let score = 0;
    const queryTerms = query.text.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const content = entry.content.toLowerCase();

    for (const term of queryTerms) {
      if (content.includes(term)) {
        score += 0.2;
      }
    }

    if (entry.embedding && this.llmService) {
      // Semantic similarity would be calculated here
      score += 0.3;
    }

    if (query.filePath && entry.metadata.filePath === query.filePath) {
      score += 0.3;
    }

    if (query.symbolName && entry.metadata.symbolName === query.symbolName) {
      score += 0.4;
    }

    if (query.tags) {
      const matchingTags = query.tags.filter((t) => entry.metadata.tags.includes(t));
      score += matchingTags.length * 0.1;
    }

    score *= entry.metadata.relevance * entry.metadata.confidence;

    return Math.min(score, 1);
  }

  private generateHighlights(entry: MemoryEntry, query: MemoryQuery): MemoryHighlight[] {
    const highlights: MemoryHighlight[] = [];
    const queryTerms = query.text.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const content = entry.content;

    for (const term of queryTerms) {
      const regex = new RegExp(`(.{0,50})(${term})(.{0,50})`, 'gi');
      const match = regex.exec(content);
      if (match) {
        const startIndex = match.index + match[1].length;
        highlights.push({
          field: 'content',
          snippet: match[0],
          positions: [{ start: startIndex, end: startIndex + term.length }],
        });
        break;
      }
    }

    return highlights;
  }

  private async generateSummary(entries: MemoryEntry[], query: string): Promise<string> {
    if (entries.length === 0) return '';

    if (this.llmService) {
      try {
        const context = entries
          .slice(0, 5)
          .map((e) => `[${e.type}] ${e.content.slice(0, 500)}`)
          .join('\n\n');

        const response = await this.llmService.complete([
          {
            role: 'system',
            content: 'Summarize the following context relevant to the query. Be concise.',
          },
          { role: 'user', content: `Query: ${query}\n\nContext:\n${context}` },
        ]);

        return response;
      } catch {
        // Fall back to basic summary
      }
    }

    return entries
      .slice(0, 3)
      .map((e) => `- ${e.content.slice(0, 200)}...`)
      .join('\n');
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async evictOldest(): Promise<void> {
    const entries = Array.from(this.entries.values());
    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const toEvict = entries.slice(0, Math.floor(this.config.maxEntries * 0.1));
    for (const entry of toEvict) {
      await this.delete(entry.id);
    }
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}
