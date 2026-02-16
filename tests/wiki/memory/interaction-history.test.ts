import { InteractionHistory } from '../../../src/wiki/memory/interaction-history';
import { InteractionRecord, InteractionType } from '../../../src/wiki/memory/interaction-types';

describe('InteractionHistory', () => {
  let history: InteractionHistory;

  beforeEach(async () => {
    history = new InteractionHistory('/tmp/test-project');
    await history.clear();
  });

  describe('record', () => {
    it('should record an interaction', async () => {
      const record: Omit<InteractionRecord, 'id' | 'timestamp'> = {
        type: InteractionType.Query,
        input: 'What is the architecture of this project?',
        output: 'The project uses a layered architecture...',
        metadata: {
          model: 'gpt-4',
          tokensUsed: 150,
          success: true,
        },
      };

      const result = await history.record(record);

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.type).toBe(InteractionType.Query);
    });

    it('should record tool call interactions', async () => {
      const record: Omit<InteractionRecord, 'id' | 'timestamp'> = {
        type: InteractionType.ToolCall,
        input: 'search_memory',
        output: JSON.stringify({ entries: [] }),
        metadata: {
          toolName: 'search_memory',
          toolArgs: { query: 'architecture' },
          success: true,
        },
      };

      const result = await history.record(record);

      expect(result.type).toBe(InteractionType.ToolCall);
    });

    it('should record code generation interactions', async () => {
      const record: Omit<InteractionRecord, 'id' | 'timestamp'> = {
        type: InteractionType.CodeGeneration,
        input: 'Create a UserService class',
        output: 'class UserService { ... }',
        metadata: {
          filesAffected: ['src/services/user.service.ts'],
          linesGenerated: 50,
          success: true,
        },
      };

      const result = await history.record(record);

      expect(result.type).toBe(InteractionType.CodeGeneration);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'Architecture question',
        output: 'Architecture answer',
        metadata: { success: true },
      });

      await history.record({
        type: InteractionType.ToolCall,
        input: 'search_memory',
        output: 'Search result',
        metadata: { toolName: 'search_memory', success: true },
      });

      await history.record({
        type: InteractionType.CodeGeneration,
        input: 'Generate code',
        output: 'Generated code',
        metadata: { success: true },
      });
    });

    it('should query by type', async () => {
      const results = await history.query({ type: InteractionType.Query });

      expect(results.length).toBe(1);
      expect(results[0].type).toBe(InteractionType.Query);
    });

    it('should query by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const results = await history.query({
        startDate: oneHourAgo,
        endDate: now,
      });

      expect(results.length).toBe(3);
    });

    it('should limit results', async () => {
      const results = await history.query({ limit: 2 });

      expect(results.length).toBe(2);
    });
  });

  describe('getRecent', () => {
    it('should return recent interactions', async () => {
      for (let i = 0; i < 10; i++) {
        await history.record({
          type: InteractionType.Query,
          input: `Query ${i}`,
          output: `Output ${i}`,
          metadata: { success: true },
        });
      }

      const recent = await history.getRecent(5);

      expect(recent.length).toBe(5);
    });
  });

  describe('getContext', () => {
    it('should return context for a query', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'What is the architecture?',
        output: 'Layered architecture with 3 layers',
        metadata: { success: true },
      });

      await history.record({
        type: InteractionType.ToolCall,
        input: 'search_memory',
        output: JSON.stringify({ entries: [{ content: 'Architecture info' }] }),
        metadata: { toolName: 'search_memory', success: true },
      });

      const context = await history.getContext('architecture');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matching context', async () => {
      const context = await history.getContext('nonexistent topic');

      expect(context).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return interaction statistics', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'Query 1',
        output: 'Output 1',
        metadata: { success: true, tokensUsed: 100 },
      });

      await history.record({
        type: InteractionType.CodeGeneration,
        input: 'Generate',
        output: 'Code',
        metadata: { success: true, tokensUsed: 200 },
      });

      await history.record({
        type: InteractionType.Query,
        input: 'Query 2',
        output: 'Output 2',
        metadata: { success: false, tokensUsed: 50 },
      });

      const stats = await history.getStats();

      expect(stats.totalInteractions).toBe(3);
      expect(stats.byType[InteractionType.Query]).toBe(2);
      expect(stats.byType[InteractionType.CodeGeneration]).toBe(1);
      expect(stats.successRate).toBeCloseTo(0.667, 2);
      expect(stats.totalTokensUsed).toBe(350);
    });
  });

  describe('clear', () => {
    it('should clear all history', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'Query',
        output: 'Output',
        metadata: { success: true },
      });

      await history.clear();

      const recent = await history.getRecent(10);
      expect(recent.length).toBe(0);
    });
  });

  describe('export', () => {
    it('should export history as JSON', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'Test query',
        output: 'Test output',
        metadata: { success: true },
      });

      const exported = await history.export();

      expect(exported).toContain('Test query');
      expect(exported).toContain('Test output');
    });
  });

  describe('replay', () => {
    it('should replay interactions for context restoration', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'What is the project structure?',
        output: 'The project has src, tests, and docs directories',
        metadata: { success: true },
      });

      await history.record({
        type: InteractionType.ToolCall,
        input: 'search_memory',
        output: JSON.stringify({ entries: [{ content: 'Module info' }] }),
        metadata: { toolName: 'search_memory', success: true },
      });

      const replay = await history.replay(2);

      expect(replay.length).toBe(2);
      expect(replay[0].input).toContain('search_memory');
    });
  });

  describe('findSimilar', () => {
    it('should find similar past interactions', async () => {
      await history.record({
        type: InteractionType.Query,
        input: 'How does authentication work?',
        output: 'Authentication uses JWT tokens',
        metadata: { success: true },
      });

      await history.record({
        type: InteractionType.Query,
        input: 'How does authorization work?',
        output: 'Authorization uses role-based access control',
        metadata: { success: true },
      });

      const similar = await history.findSimilar('authentication mechanism');

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].input).toContain('authentication');
    });
  });
});
