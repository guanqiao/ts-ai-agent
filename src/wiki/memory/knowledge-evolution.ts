import { WikiSearchMemory } from './wiki-search-memory';
import { InteractionHistory } from './interaction-history';
import { MemoryEntry, MemoryEntryType } from './types';

export interface KnowledgeUpdateOptions {
  newContent: string;
  type?: MemoryEntryType;
  source: string;
  tags?: string[];
}

export interface CleanupOptions {
  maxAge?: number;
  minRelevance?: number;
  minAccessCount?: number;
}

export interface BoostOptions {
  minAccessCount: number;
  boostFactor: number;
}

export interface EvolutionResult {
  timestamp: Date;
  changes: {
    updated: number;
    created: number;
    removed: number;
    merged: number;
    boosted: number;
  };
  patternsLearned: number;
  gapsDetected: string[];
}

export interface KnowledgeUpdateResult {
  updated: boolean;
  created: boolean;
  entry?: MemoryEntry;
}

export interface CleanupResult {
  removedCount: number;
  removedEntries: string[];
}

export interface ConsolidationResult {
  mergedCount: number;
  mergedEntries: Array<{ kept: string; removed: string[] }>;
}

export interface BoostResult {
  boostedCount: number;
  boostedEntries: string[];
}

export class KnowledgeEvolution {
  private memoryService: WikiSearchMemory;
  private interactionHistory: InteractionHistory;

  constructor(memoryService: WikiSearchMemory, interactionHistory: InteractionHistory) {
    this.memoryService = memoryService;
    this.interactionHistory = interactionHistory;
  }

  async updateKnowledge(
    query: string,
    options: KnowledgeUpdateOptions
  ): Promise<KnowledgeUpdateResult> {
    const existingResults = await this.memoryService.query({
      text: query,
      limit: 5,
    });

    if (existingResults.length > 0) {
      const existing = existingResults[0].entry;
      const updated: MemoryEntry = {
        ...existing,
        content: options.newContent,
        metadata: {
          ...existing.metadata,
          source: options.source,
          confidence: Math.min(existing.metadata.confidence + 0.1, 1),
          tags: [...new Set([...existing.metadata.tags, ...(options.tags || [])])],
        },
        updatedAt: new Date(),
      };

      await this.memoryService.update(existing.id, updated);

      return {
        updated: true,
        created: false,
        entry: updated,
      };
    }

    const newEntry = await this.memoryService.storeKnowledge(
      options.newContent,
      options.type || MemoryEntryType.Documentation,
      {
        source: options.source,
        tags: options.tags || [],
        relevance: 0.8,
        confidence: 0.7,
      }
    );

    return {
      updated: false,
      created: true,
      entry: newEntry,
    };
  }

  async cleanupOutdated(options: CleanupOptions): Promise<CleanupResult> {
    const maxAge = options.maxAge || 90;
    const minRelevance = options.minRelevance || 0.3;
    const minAccessCount = options.minAccessCount || 0;

    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

    const allResults = await this.memoryService.query({
      text: '',
      limit: 1000,
    });

    const toRemove: string[] = [];

    for (const result of allResults) {
      const entry = result.entry;
      const isOld = entry.updatedAt < cutoffDate;
      const isLowRelevance = entry.metadata.relevance < minRelevance;
      const isUnaccessed = entry.accessCount <= minAccessCount;

      if (isOld && isLowRelevance && isUnaccessed) {
        toRemove.push(entry.id);
      }
    }

    for (const id of toRemove) {
      await this.memoryService.delete(id);
    }

    return {
      removedCount: toRemove.length,
      removedEntries: toRemove,
    };
  }

  async learnFromInteractions(): Promise<{ patternsLearned: number }> {
    const stats = await this.interactionHistory.getStats();
    let patternsLearned = 0;

    if (stats.mostUsedTools && stats.mostUsedTools.length > 0) {
      const toolPatterns = stats.mostUsedTools
        .filter((t) => t.count > 10)
        .map((t) => `Frequently used tool: ${t.name} (${t.count} times)`);

      for (const pattern of toolPatterns) {
        await this.memoryService.storeKnowledge(pattern, MemoryEntryType.Pattern, {
          source: 'interaction-analysis',
          tags: ['tool-usage', 'pattern'],
          relevance: 0.8,
          confidence: 0.9,
        });
        patternsLearned++;
      }
    }

    return { patternsLearned };
  }

  async consolidateKnowledge(): Promise<ConsolidationResult> {
    const allResults = await this.memoryService.query({
      text: '',
      limit: 1000,
    });

    const entries = allResults.map((r) => r.entry);
    const mergedEntries: Array<{ kept: string; removed: string[] }> = [];
    let mergedCount = 0;

    const processed = new Set<string>();

    for (const entry of entries) {
      if (processed.has(entry.id)) continue;

      const similar = entries.filter(
        (e) =>
          e.id !== entry.id &&
          !processed.has(e.id) &&
          e.type === entry.type &&
          this.calculateSimilarity(entry.content, e.content) > 0.8
      );

      if (similar.length > 0) {
        const toRemove: string[] = [];

        for (const dup of similar) {
          if (entry.accessCount >= dup.accessCount) {
            toRemove.push(dup.id);
            processed.add(dup.id);
          } else {
            toRemove.push(entry.id);
            processed.add(entry.id);
            break;
          }
        }

        for (const id of toRemove) {
          await this.memoryService.delete(id);
        }

        if (toRemove.length > 0) {
          mergedEntries.push({
            kept: entry.id,
            removed: toRemove,
          });
          mergedCount += toRemove.length;
        }
      }

      processed.add(entry.id);
    }

    return {
      mergedCount,
      mergedEntries,
    };
  }

  async boostRelevance(options: BoostOptions): Promise<BoostResult> {
    const allResults = await this.memoryService.query({
      text: '',
      limit: 1000,
    });

    const boostedEntries: string[] = [];

    for (const result of allResults) {
      const entry = result.entry;

      if (entry.accessCount >= options.minAccessCount) {
        const newRelevance = Math.min(entry.metadata.relevance * options.boostFactor, 1);

        await this.memoryService.update(entry.id, {
          metadata: {
            ...entry.metadata,
            relevance: newRelevance,
          },
        });

        boostedEntries.push(entry.id);
      }
    }

    return {
      boostedCount: boostedEntries.length,
      boostedEntries,
    };
  }

  async detectKnowledgeGaps(): Promise<string[]> {
    const gaps: string[] = [];

    const failedInteractions = await this.interactionHistory.query({
      success: false,
      limit: 20,
    });

    if (failedInteractions && Array.isArray(failedInteractions)) {
      for (const interaction of failedInteractions) {
        if (
          interaction.output.toLowerCase().includes('do not have') ||
          interaction.output.toLowerCase().includes('no information') ||
          interaction.output.toLowerCase().includes('not found')
        ) {
          const keywords = this.extractKeywords(interaction.input);
          gaps.push(`Missing knowledge about: ${keywords.join(', ')}`);
        }
      }
    }

    return [...new Set(gaps)];
  }

  async evolve(): Promise<EvolutionResult> {
    const changes = {
      updated: 0,
      created: 0,
      removed: 0,
      merged: 0,
      boosted: 0,
    };

    const cleanupResult = await this.cleanupOutdated({
      maxAge: 60,
      minRelevance: 0.2,
    });
    changes.removed = cleanupResult.removedCount;

    const consolidationResult = await this.consolidateKnowledge();
    changes.merged = consolidationResult.mergedCount;

    const boostResult = await this.boostRelevance({
      minAccessCount: 10,
      boostFactor: 1.1,
    });
    changes.boosted = boostResult.boostedCount;

    const learnResult = await this.learnFromInteractions();
    changes.created = learnResult.patternsLearned;

    const gaps = await this.detectKnowledgeGaps();

    return {
      timestamp: new Date(),
      changes,
      patternsLearned: learnResult.patternsLearned,
      gapsDetected: gaps,
    };
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
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
      'how',
      'what',
      'why',
      'when',
      'where',
      'which',
      'who',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }
}
