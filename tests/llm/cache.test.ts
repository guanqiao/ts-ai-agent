import { LLMCache, CacheConfig, DEFAULT_CACHE_CONFIG } from '../../src/llm/cache';

jest.mock('fs');

describe('LLMCache', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new LLMCache<string>({ persistToDisk: false });
  });

  describe('constructor', () => {
    it('should create cache with default config', () => {
      expect(cache).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const customCache = new LLMCache({ ttlMs: 60000, persistToDisk: false });
      expect(customCache).toBeDefined();
    });
  });

  describe('generateKey', () => {
    it('should generate consistent key for same inputs', () => {
      const key1 = cache.generateKey('test prompt', 'gpt-4', 0.7);
      const key2 = cache.generateKey('test prompt', 'gpt-4', 0.7);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey('prompt 1', 'gpt-4', 0.7);
      const key2 = cache.generateKey('prompt 2', 'gpt-4', 0.7);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', () => {
      const key1 = cache.generateKey('prompt', 'gpt-4', 0.7);
      const key2 = cache.generateKey('prompt', 'gpt-3.5-turbo', 0.7);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different temperatures', () => {
      const key1 = cache.generateKey('prompt', 'gpt-4', 0.7);
      const key2 = cache.generateKey('prompt', 'gpt-4', 0.5);

      expect(key1).not.toBe(key2);
    });
  });

  describe('set and get', () => {
    it('should set and get a value', () => {
      const key = cache.generateKey('test', 'gpt-4');
      cache.set(key, 'response');

      const result = cache.get(key);

      expect(result).toBe('response');
    });

    it('should return undefined for non-existent key', () => {
      const result = cache.get('non-existent-key');

      expect(result).toBeUndefined();
    });

    it('should update hit count on get', () => {
      const key = cache.generateKey('test', 'gpt-4');
      cache.set(key, 'response');

      cache.get(key);
      cache.get(key);
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(3);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      const key = cache.generateKey('test', 'gpt-4');
      cache.set(key, 'response');

      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an entry', () => {
      const key = cache.generateKey('test', 'gpt-4');
      cache.set(key, 'response');

      const result = cache.delete(key);

      expect(result).toBe(true);
      expect(cache.get(key)).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const result = cache.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(DEFAULT_CACHE_CONFIG.maxSize);
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.totalHits).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      cache.set(key, 'cached');

      const result = await cache.getOrSet(key, () => Promise.resolve('new'));

      expect(result).toBe('cached');
    });

    it('should call factory if not cached', async () => {
      const key = 'test-key';
      const factory = jest.fn().mockResolvedValue('new-value');

      const result = await cache.getOrSet(key, factory);

      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should cache result from factory', async () => {
      const key = 'test-key';
      const factory = jest.fn().mockResolvedValue('new-value');

      await cache.getOrSet(key, factory);
      await cache.getOrSet(key, factory);

      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('pruneExpired', () => {
    it('should remove expired entries', () => {
      const shortCache = new LLMCache<string>({ 
        ttlMs: 1, 
        persistToDisk: false 
      });

      shortCache.set('key1', 'value1');
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const pruned = shortCache.pruneExpired();
          expect(pruned).toBe(1);
          resolve();
        }, 10);
      });
    });
  });

  describe('disabled cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new LLMCache<string>({ 
        enabled: false, 
        persistToDisk: false 
      });

      disabledCache.set('key', 'value');

      expect(disabledCache.get('key')).toBeUndefined();
    });
  });

  describe('maxSize', () => {
    it('should evict oldest entry when max size reached', () => {
      const smallCache = new LLMCache<string>({ 
        maxSize: 2, 
        persistToDisk: false 
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      const stats = smallCache.getStats();
      expect(stats.size).toBe(2);
      expect(smallCache.get('key1')).toBeUndefined();
    });
  });
});

describe('DEFAULT_CACHE_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CACHE_CONFIG.ttlMs).toBe(24 * 60 * 60 * 1000);
    expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    expect(DEFAULT_CACHE_CONFIG.persistToDisk).toBe(true);
  });
});

describe('CacheConfig', () => {
  it('should allow partial config', () => {
    const partialConfig: Partial<CacheConfig> = {
      enabled: false,
    };

    expect(partialConfig.enabled).toBe(false);
  });
});
