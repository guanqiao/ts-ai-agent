import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  metadata?: Record<string, unknown>;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize: number;
  cacheDir?: string;
  persistToDisk: boolean;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMs: 24 * 60 * 60 * 1000,
  maxSize: 1000,
  persistToDisk: true,
};

export class LLMCache<T = string> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private cacheFile?: string;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

    if (this.config.persistToDisk && this.config.cacheDir) {
      this.cacheFile = path.join(this.config.cacheDir, 'llm-cache.json');
      this.loadFromDisk();
    }
  }

  generateKey(prompt: string, model: string, temperature?: number): string {
    const content = `${prompt}:${model}:${temperature || 'default'}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  get(key: string): T | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hitCount++;
    return entry.value;
  }

  set(key: string, value: T, metadata?: Record<string, unknown>): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const now = new Date();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttlMs),
      hitCount: 0,
      metadata,
    };

    this.cache.set(key, entry);

    if (this.config.persistToDisk) {
      this.saveToDisk();
    }
  }

  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    return new Date() <= entry.expiresAt;
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result && this.config.persistToDisk) {
      this.saveToDisk();
    }
    return result;
  }

  clear(): void {
    this.cache.clear();
    if (this.config.persistToDisk) {
      this.saveToDisk();
    }
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let totalHits = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalHits,
      oldestEntry,
      newestEntry,
    };
  }

  getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    return factory().then((value) => {
      this.set(key, value);
      return value;
    });
  }

  async getOrSetAsync(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }

  pruneExpired(): number {
    const now = new Date();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0 && this.config.persistToDisk) {
      this.saveToDisk();
    }

    return pruned;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestDate: Date | undefined;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestDate || entry.createdAt < oldestDate) {
        oldestKey = key;
        oldestDate = entry.createdAt;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private loadFromDisk(): void {
    if (!this.cacheFile || !fs.existsSync(this.cacheFile)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.cacheFile, 'utf-8');
      const entries = JSON.parse(data) as CacheEntry<T>[];

      const now = new Date();
      for (const entry of entries) {
        entry.createdAt = new Date(entry.createdAt);
        entry.expiresAt = new Date(entry.expiresAt);

        if (entry.expiresAt > now) {
          this.cache.set(entry.key, entry);
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from disk:', error);
    }
  }

  private saveToDisk(): void {
    if (!this.cacheFile) {
      return;
    }

    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const entries = Array.from(this.cache.values());
      fs.writeFileSync(this.cacheFile, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save cache to disk:', error);
    }
  }
}

export const globalLLMCache = new LLMCache<string>({
  enabled: true,
  ttlMs: 24 * 60 * 60 * 1000,
  maxSize: 500,
  persistToDisk: false,
});
