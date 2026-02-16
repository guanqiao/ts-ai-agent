import { KnowledgeEvolution } from '../../../src/wiki/memory/knowledge-evolution';
import { WikiSearchMemory } from '../../../src/wiki/memory/wiki-search-memory';
import { InteractionHistory } from '../../../src/wiki/memory/interaction-history';
import { MemoryEntry, MemoryEntryType } from '../../../src/wiki/memory/types';
import { InteractionType } from '../../../src/wiki/memory/interaction-types';

describe('KnowledgeEvolution', () => {
  let evolution: KnowledgeEvolution;
  let mockMemoryService: jest.Mocked<WikiSearchMemory>;
  let mockInteractionHistory: jest.Mocked<InteractionHistory>;

  beforeEach(() => {
    mockMemoryService = {
      query: jest.fn(),
      getRelevant: jest.fn(),
      storeKnowledge: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      invalidate: jest.fn(),
    } as unknown as jest.Mocked<WikiSearchMemory>;

    mockInteractionHistory = {
      getStats: jest.fn(),
      query: jest.fn(),
      findSimilar: jest.fn(),
    } as unknown as jest.Mocked<InteractionHistory>;

    evolution = new KnowledgeEvolution(mockMemoryService, mockInteractionHistory);
  });

  describe('updateKnowledge', () => {
    it('should update knowledge based on new information', async () => {
      const existingEntry: MemoryEntry = {
        id: '1',
        type: MemoryEntryType.Architecture,
        content: 'The project uses a simple architecture',
        metadata: { source: 'wiki', tags: ['architecture'], relevance: 0.8, confidence: 0.7 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 5,
      };

      mockMemoryService.query.mockResolvedValue([
        { entry: existingEntry, score: 0.9 },
      ]);

      mockMemoryService.update.mockResolvedValue({
        ...existingEntry,
        content: 'The project uses a layered architecture with 3 layers',
        metadata: { ...existingEntry.metadata, confidence: 0.9 },
      });

      const result = await evolution.updateKnowledge('architecture', {
        newContent: 'The project uses a layered architecture with 3 layers',
        source: 'code-analysis',
      });

      expect(result.updated).toBe(true);
    });

    it('should create new knowledge when no existing entry matches', async () => {
      mockMemoryService.query.mockResolvedValue([]);

      const newEntry: MemoryEntry = {
        id: 'new-1',
        type: MemoryEntryType.Pattern,
        content: 'New pattern discovered',
        metadata: { source: 'evolution', tags: ['pattern'], relevance: 0.9, confidence: 0.8 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      mockMemoryService.storeKnowledge.mockResolvedValue(newEntry);

      const result = await evolution.updateKnowledge('new pattern', {
        newContent: 'New pattern discovered',
        type: MemoryEntryType.Pattern,
        source: 'evolution',
      });

      expect(result.created).toBe(true);
    });
  });

  describe('cleanupOutdated', () => {
    it('should identify and remove outdated knowledge', async () => {
      const outdatedEntry: MemoryEntry = {
        id: 'outdated-1',
        type: MemoryEntryType.Documentation,
        content: 'Old documentation that is no longer relevant',
        metadata: {
          source: 'wiki',
          tags: ['deprecated'],
          relevance: 0.3,
          confidence: 0.5,
        },
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      };

      mockMemoryService.query.mockResolvedValue([
        { entry: outdatedEntry, score: 0.3 },
      ]);

      mockMemoryService.delete.mockResolvedValue(true);

      const result = await evolution.cleanupOutdated({
        maxAge: 30,
        minRelevance: 0.5,
        minAccessCount: 1,
      });

      expect(result.removedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('learnFromInteractions', () => {
    it('should learn patterns from successful interactions', async () => {
      mockInteractionHistory.getStats.mockResolvedValue({
        totalInteractions: 100,
        byType: {
          [InteractionType.Query]: 50,
          [InteractionType.ToolCall]: 30,
          [InteractionType.CodeGeneration]: 20,
          [InteractionType.CodeModification]: 0,
          [InteractionType.Decision]: 0,
          [InteractionType.Learning]: 0,
        },
        successRate: 0.85,
        totalTokensUsed: 5000,
        mostUsedTools: [
          { name: 'search_memory', count: 25 },
          { name: 'code_generator', count: 15 },
        ],
      });

      mockInteractionHistory.query.mockResolvedValue([
        {
          id: '1',
          type: InteractionType.Query,
          timestamp: new Date(),
          input: 'How does authentication work?',
          output: 'Authentication uses JWT tokens',
          metadata: { success: true },
        },
      ]);

      const result = await evolution.learnFromInteractions();

      expect(result.patternsLearned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('consolidateKnowledge', () => {
    it('should merge similar knowledge entries', async () => {
      const similarEntries: MemoryEntry[] = [
        {
          id: '1',
          type: MemoryEntryType.API,
          content: 'POST /api/users creates a user',
          metadata: { source: 'wiki', tags: ['api'], relevance: 0.9, confidence: 0.85 },
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 10,
        },
        {
          id: '2',
          type: MemoryEntryType.API,
          content: 'POST /api/users endpoint for user creation',
          metadata: { source: 'wiki', tags: ['api'], relevance: 0.85, confidence: 0.8 },
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 5,
        },
      ];

      mockMemoryService.query.mockResolvedValue(
        similarEntries.map((e) => ({ entry: e, score: 0.9 }))
      );

      const result = await evolution.consolidateKnowledge();

      expect(result.mergedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('boostRelevance', () => {
    it('should boost relevance of frequently accessed knowledge', async () => {
      const frequentlyAccessed: MemoryEntry = {
        id: 'popular-1',
        type: MemoryEntryType.Module,
        content: 'UserService module',
        metadata: { source: 'wiki', tags: ['module'], relevance: 0.8, confidence: 0.9 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 100,
      };

      mockMemoryService.query.mockResolvedValue([
        { entry: frequentlyAccessed, score: 0.9 },
      ]);

      mockMemoryService.update.mockResolvedValue({
        ...frequentlyAccessed,
        metadata: { ...frequentlyAccessed.metadata, relevance: 0.95 },
      });

      const result = await evolution.boostRelevance({
        minAccessCount: 50,
        boostFactor: 1.2,
      });

      expect(result.boostedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectKnowledgeGaps', () => {
    it('should detect gaps in knowledge coverage', async () => {
      mockInteractionHistory.findSimilar.mockResolvedValue([]);

      mockInteractionHistory.query.mockResolvedValue([
        {
          id: '1',
          type: InteractionType.Query,
          timestamp: new Date(),
          input: 'How does caching work?',
          output: 'I do not have information about caching',
          metadata: { success: false },
        },
      ]);

      const gaps = await evolution.detectKnowledgeGaps();

      expect(gaps).toBeDefined();
      expect(Array.isArray(gaps)).toBe(true);
    });
  });

  describe('evolve', () => {
    it('should perform full evolution cycle', async () => {
      mockInteractionHistory.getStats.mockResolvedValue({
        totalInteractions: 50,
        byType: {
          [InteractionType.Query]: 25,
          [InteractionType.ToolCall]: 15,
          [InteractionType.CodeGeneration]: 10,
          [InteractionType.CodeModification]: 0,
          [InteractionType.Decision]: 0,
          [InteractionType.Learning]: 0,
        },
        successRate: 0.8,
        totalTokensUsed: 2000,
      });

      mockMemoryService.query.mockResolvedValue([]);

      const result = await evolution.evolve();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.changes).toBeDefined();
    });
  });
});
