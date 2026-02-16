import { WikiSearchMemory } from '../../../src/wiki/memory/wiki-search-memory';
import { KnowledgeCache } from '../../../src/wiki/memory/knowledge-cache';
import { AgentMemoryBridge } from '../../../src/wiki/memory/agent-memory-bridge';
import { MemoryEntryType } from '../../../src/wiki/memory/types';
import * as fs from 'fs';
import * as path from 'path';

describe('WikiSearchMemory', () => {
  let memory: WikiSearchMemory;
  const testProjectPath = path.join(__dirname, 'test-project');

  beforeAll(() => {
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    memory = new WikiSearchMemory();
  });

  describe('store', () => {
    it('should store a memory entry', async () => {
      const entry = await memory.store({
        type: MemoryEntryType.Code,
        content: 'function hello() { return "world"; }',
        metadata: {
          source: 'test',
          tags: ['function', 'test'],
          relevance: 1,
          confidence: 1,
        },
      });

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe(MemoryEntryType.Code);
      expect(entry.createdAt).toBeInstanceOf(Date);
      expect(entry.accessCount).toBe(0);
    });

    it('should store multiple entries', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'entry 1',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
      });

      await memory.store({
        type: MemoryEntryType.Documentation,
        content: 'entry 2',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
      });

      const results = await memory.query({ text: 'entry', limit: 10 });
      expect(results.length).toBe(2);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'function calculateSum(a, b) { return a + b; }',
        metadata: {
          source: 'test',
          symbolName: 'calculateSum',
          tags: ['math', 'sum'],
          relevance: 1,
          confidence: 1,
        },
      });

      await memory.store({
        type: MemoryEntryType.Documentation,
        content: 'This module provides mathematical utilities',
        metadata: {
          source: 'test',
          tags: ['math', 'utilities'],
          relevance: 0.8,
          confidence: 1,
        },
      });
    });

    it('should query by text', async () => {
      const results = await memory.query({ text: 'calculate', limit: 10 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.content).toContain('calculate');
    });

    it('should filter by type', async () => {
      const results = await memory.query({
        text: 'math',
        types: [MemoryEntryType.Code],
        limit: 10,
      });

      expect(results.every((r) => r.entry.type === MemoryEntryType.Code)).toBe(true);
    });

    it('should filter by tags', async () => {
      const results = await memory.query({
        text: 'math',
        tags: ['math'],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit', async () => {
      const results = await memory.query({ text: '', limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should apply threshold', async () => {
      const results = await memory.query({
        text: 'nonexistent-term-xyz',
        threshold: 0.9,
        limit: 10,
      });

      expect(results.length).toBe(0);
    });
  });

  describe('getRelevant', () => {
    it('should return relevant entries', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'export class UserService { getUser() {} }',
        metadata: {
          source: 'test',
          symbolName: 'UserService',
          tags: ['service', 'user'],
          relevance: 1,
          confidence: 1,
        },
      });

      const relevant = await memory.getRelevant('UserService', 5);
      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant[0].metadata.symbolName).toBe('UserService');
    });
  });

  describe('invalidate', () => {
    it('should invalidate entries by filter', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'test content',
        metadata: {
          source: 'test',
          filePath: 'src/test.ts',
          tags: [],
          relevance: 1,
          confidence: 1,
        },
      });

      const count = await memory.invalidate({ filePath: 'src/test.ts' });
      expect(count).toBe(1);
    });
  });

  describe('update', () => {
    it('should update an existing entry', async () => {
      const entry = await memory.store({
        type: MemoryEntryType.Code,
        content: 'original content',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
      });

      const updated = await memory.update(entry.id, {
        content: 'updated content',
      });

      expect(updated?.content).toBe('updated content');
    });
  });

  describe('delete', () => {
    it('should delete an entry', async () => {
      const entry = await memory.store({
        type: MemoryEntryType.Code,
        content: 'to be deleted',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
      });

      const result = await memory.delete(entry.id);
      expect(result).toBe(true);

      const found = await memory.getById(entry.id);
      expect(found).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'entry 1',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
      });

      await memory.clear();
      const results = await memory.query({ text: '', limit: 100 });
      expect(results.length).toBe(0);
    });
  });
});

describe('KnowledgeCache', () => {
  let cache: KnowledgeCache;
  const testCachePath = path.join(__dirname, 'test-cache');

  beforeAll(() => {
    if (!fs.existsSync(testCachePath)) {
      fs.mkdirSync(testCachePath, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testCachePath)) {
      fs.rmSync(testCachePath, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    cache = new KnowledgeCache(testCachePath, 60000);
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('cache and get', () => {
    it('should cache and retrieve an entry', async () => {
      const entry: any = {
        id: 'test-1',
        type: MemoryEntryType.Code,
        content: 'test content',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      await cache.cache('test-key', entry);
      const retrieved = await cache.get('test-key');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('test content');
    });

    it('should return null for missing key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('should invalidate a cached entry', async () => {
      const entry: any = {
        id: 'test-1',
        type: MemoryEntryType.Code,
        content: 'test',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      await cache.cache('test-key', entry);
      const result = await cache.invalidate('test-key');

      expect(result).toBe(true);
      expect(await cache.get('test-key')).toBeNull();
    });

    it('should invalidate by pattern', async () => {
      const entry: any = {
        id: 'test',
        type: MemoryEntryType.Code,
        content: 'test',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      await cache.cache('file:src/a.ts', entry);
      await cache.cache('file:src/b.ts', entry);
      await cache.cache('symbol:test', entry);

      const count = await cache.invalidatePattern('file:.*');
      expect(count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const entry: any = {
        id: 'test',
        type: MemoryEntryType.Code,
        content: 'test content',
        metadata: { source: 'test', tags: [], relevance: 1, confidence: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };

      await cache.cache('key1', entry);
      await cache.get('key1');
      await cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });
});

describe('AgentMemoryBridge', () => {
  let bridge: AgentMemoryBridge;
  let memory: WikiSearchMemory;
  let cache: KnowledgeCache;
  const testPath = path.join(__dirname, 'test-bridge');

  beforeAll(() => {
    if (!fs.existsSync(testPath)) {
      fs.mkdirSync(testPath, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testPath)) {
      fs.rmSync(testPath, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    memory = new WikiSearchMemory();
    cache = new KnowledgeCache(testPath);
    bridge = new AgentMemoryBridge(memory, cache);
  });

  describe('provideContext', () => {
    it('should provide context for a query', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'export class UserService { getUser() {} }',
        metadata: {
          source: 'test',
          symbolName: 'UserService',
          tags: ['service'],
          relevance: 1,
          confidence: 1,
        },
      });

      const context = await bridge.provideContext('UserService');

      expect(context).toBeDefined();
      expect(context.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('enrichPrompt', () => {
    it('should enrich a prompt with context', async () => {
      await memory.store({
        type: MemoryEntryType.Documentation,
        content: 'UserService handles user authentication and profile management.',
        metadata: {
          source: 'test',
          tags: ['service', 'user'],
          relevance: 1,
          confidence: 1,
        },
      });

      const prompt = 'Explain the UserService';
      const enriched = await bridge.enrichPrompt(prompt);

      expect(enriched).toContain('Relevant Context');
      expect(enriched).toContain('Explain the UserService');
    });
  });

  describe('storeKnowledge', () => {
    it('should store knowledge through the bridge', async () => {
      const entry = await bridge.storeKnowledge(
        'This is important knowledge',
        MemoryEntryType.Decision,
        { source: 'test', tags: ['important'] }
      );

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe(MemoryEntryType.Decision);
    });
  });

  describe('getRelevantSymbols', () => {
    it('should return entries for a symbol', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'export function calculateTotal() {}',
        metadata: {
          source: 'test',
          symbolName: 'calculateTotal',
          tags: [],
          relevance: 1,
          confidence: 1,
        },
      });

      const symbols = await bridge.getRelevantSymbols('calculateTotal');
      expect(symbols.length).toBeGreaterThan(0);
    });
  });

  describe('getRelevantFiles', () => {
    it('should return entries for a file', async () => {
      await memory.store({
        type: MemoryEntryType.Code,
        content: 'file content',
        metadata: {
          source: 'test',
          filePath: 'src/utils.ts',
          tags: [],
          relevance: 1,
          confidence: 1,
        },
      });

      const files = await bridge.getRelevantFiles('src/utils.ts');
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
