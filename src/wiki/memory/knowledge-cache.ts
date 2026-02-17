import * as path from 'path';
import * as fs from 'fs';
import { MemoryEntry, IKnowledgeCache, CacheStats } from './types';

interface CacheEntry {
  entry: MemoryEntry;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export class KnowledgeCache implements IKnowledgeCache {
  private _cache: Map<string, CacheEntry> = new Map();
  private storagePath: string;
  private hits: number = 0;
  private misses: number = 0;
  private defaultTTL: number;

  constructor(projectPath: string, defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.storagePath = path.join(projectPath, '.wiki', 'cache');
    this.defaultTTL = defaultTTL;
    this.loadFromDisk();
  }

  async cache(key: string, entry: MemoryEntry, ttl?: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this._cache.set(key, {
      entry,
      createdAt: now,
      expiresAt,
      hits: 0,
    });

    await this.saveToDisk();
  }

  async get(key: string): Promise<MemoryEntry | null> {
    const cached = this._cache.get(key);

    if (!cached) {
      this.misses++;
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this._cache.delete(key);
      this.misses++;
      return null;
    }

    cached.hits++;
    this.hits++;
    return cached.entry;
  }

  async invalidate(key: string): Promise<boolean> {
    const existed = this._cache.delete(key);
    if (existed) {
      await this.saveToDisk();
    }
    return existed;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this._cache.keys()) {
      if (regex.test(key)) {
        this._cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      await this.saveToDisk();
    }

    return count;
  }

  async refresh(key: string): Promise<MemoryEntry | null> {
    const cached = this._cache.get(key);
    if (!cached) return null;

    cached.createdAt = Date.now();
    cached.expiresAt = Date.now() + this.defaultTTL;
    cached.hits = 0;

    await this.saveToDisk();
    return cached.entry;
  }

  async clear(): Promise<void> {
    this._cache.clear();
    this.hits = 0;
    this.misses = 0;
    await this.saveToDisk();
  }

  getStats(): CacheStats {
    const entries = Array.from(this._cache.values());
    const now = Date.now();

    const totalEntries = this._cache.size;
    const totalSize = entries.reduce((sum, e) => sum + e.entry.content.length, 0);
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0;
    const averageAge =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + (now - e.createdAt), 0) / entries.length
        : 0;

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      averageAge,
    };
  }

  private async saveToDisk(): Promise<void> {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    const cachePath = path.join(this.storagePath, 'knowledge-cache.json');
    const data: Record<string, CacheEntry> = {};

    for (const [key, value] of this._cache) {
      data[key] = value;
    }

    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  }

  private loadFromDisk(): void {
    const cachePath = path.join(this.storagePath, 'knowledge-cache.json');

    if (!fs.existsSync(cachePath)) {
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const now = Date.now();

      for (const [key, value] of Object.entries(data)) {
        const entry = value as CacheEntry;
        if (entry.expiresAt > now) {
          this._cache.set(key, entry);
        }
      }
    } catch {
      // Ignore loading errors
    }
  }

  async getExpiredKeys(): Promise<string[]> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this._cache) {
      if (value.expiresAt <= now) {
        expired.push(key);
      }
    }

    return expired;
  }

  async cleanupExpired(): Promise<number> {
    const expired = await this.getExpiredKeys();

    for (const key of expired) {
      this._cache.delete(key);
    }

    if (expired.length > 0) {
      await this.saveToDisk();
    }

    return expired.length;
  }

  async getKeysByType(type: string): Promise<string[]> {
    const keys: string[] = [];

    for (const [key, value] of this._cache) {
      if (value.entry.type === type) {
        keys.push(key);
      }
    }

    return keys;
  }

  async getHotKeys(threshold: number = 5): Promise<string[]> {
    const hotKeys: string[] = [];

    for (const [key, value] of this._cache) {
      if (value.hits >= threshold) {
        hotKeys.push(key);
      }
    }

    return hotKeys.sort((a, b) => {
      const aHits = this._cache.get(a)?.hits || 0;
      const bHits = this._cache.get(b)?.hits || 0;
      return bHits - aHits;
    });
  }
}
