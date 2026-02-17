import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedFile, CodeSymbol, SymbolKind } from '../../types';

interface FileHashCache {
  filePath: string;
  contentHash: string;
  symbolHash: string;
  symbolCount: number;
  lastModified: Date;
  fileSize: number;
  cachedAt: Date;
}

interface SymbolHashCache {
  symbolId: string;
  symbolName: string;
  symbolKind: SymbolKind;
  signatureHash: string;
  descriptionHash: string;
  combinedHash: string;
  filePath: string;
  cachedAt: Date;
}

interface HashCacheData {
  version: string;
  fileCaches: Map<string, FileHashCache>;
  symbolCaches: Map<string, SymbolHashCache>;
  lastCleanup: Date;
  stats: {
    hits: number;
    misses: number;
    totalRequests: number;
  };
}

export class HashCacheManager {
  private cachePath: string;
  private cacheData: HashCacheData;
  private maxCacheAge: number;
  private maxCacheSize: number;

  constructor(cacheDir: string, maxCacheAge: number = 24 * 60 * 60 * 1000, maxCacheSize: number = 10000) {
    this.cachePath = path.join(cacheDir, 'hash-cache.json');
    this.maxCacheAge = maxCacheAge;
    this.maxCacheSize = maxCacheSize;
    this.cacheData = this.loadCache();
  }

  getFileHash(_filePath: string, content: string): string {
    return this.quickHash(content);
  }

  getOrComputeFileHash(file: ParsedFile): { contentHash: string; symbolHash: string } {
    this.cacheData.stats.totalRequests++;

    const cached = this.cacheData.fileCaches.get(file.path);
    const contentHash = this.quickHash(file.rawContent || '');

    if (cached && cached.contentHash === contentHash) {
      this.cacheData.stats.hits++;
      return {
        contentHash: cached.contentHash,
        symbolHash: cached.symbolHash,
      };
    }

    this.cacheData.stats.misses++;

    const symbolHash = this.computeSymbolHash(file.symbols);

    const newCache: FileHashCache = {
      filePath: file.path,
      contentHash,
      symbolHash,
      symbolCount: file.symbols.length,
      lastModified: new Date(),
      fileSize: (file.rawContent || '').length,
      cachedAt: new Date(),
    };

    this.cacheData.fileCaches.set(file.path, newCache);
    this.maybeCleanup();

    return { contentHash, symbolHash };
  }

  getOrComputeSymbolHash(symbol: CodeSymbol, filePath: string): string {
    this.cacheData.stats.totalRequests++;

    const symbolId = `${filePath}:${symbol.name}:${symbol.kind}`;
    const cached = this.cacheData.symbolCaches.get(symbolId);

    const signatureHash = this.quickHash(symbol.signature || '');
    const descriptionHash = this.quickHash(symbol.description || '');

    if (cached && cached.signatureHash === signatureHash && cached.descriptionHash === descriptionHash) {
      this.cacheData.stats.hits++;
      return cached.combinedHash;
    }

    this.cacheData.stats.misses++;

    const combinedHash = this.quickHash(
      `${symbol.name}:${symbol.kind}:${signatureHash}:${descriptionHash}`
    );

    const newCache: SymbolHashCache = {
      symbolId,
      symbolName: symbol.name,
      symbolKind: symbol.kind,
      signatureHash,
      descriptionHash,
      combinedHash,
      filePath,
      cachedAt: new Date(),
    };

    this.cacheData.symbolCaches.set(symbolId, newCache);

    return combinedHash;
  }

  hasFileChanged(filePath: string, currentContent: string): boolean {
    const cached = this.cacheData.fileCaches.get(filePath);
    if (!cached) {
      return true;
    }

    const currentHash = this.quickHash(currentContent);
    return cached.contentHash !== currentHash;
  }

  hasSymbolChanged(symbol: CodeSymbol, filePath: string): boolean {
    const symbolId = `${filePath}:${symbol.name}:${symbol.kind}`;
    const cached = this.cacheData.symbolCaches.get(symbolId);

    if (!cached) {
      return true;
    }

    const signatureHash = this.quickHash(symbol.signature || '');
    const descriptionHash = this.quickHash(symbol.description || '');

    return cached.signatureHash !== signatureHash || cached.descriptionHash !== descriptionHash;
  }

  getChangedSymbols(file: ParsedFile): { added: CodeSymbol[]; modified: CodeSymbol[]; deleted: CodeSymbol[] } {
    const added: CodeSymbol[] = [];
    const modified: CodeSymbol[] = [];
    const deleted: CodeSymbol[] = [];

    const currentSymbolIds = new Set<string>();
    for (const symbol of file.symbols) {
      const symbolId = `${file.path}:${symbol.name}:${symbol.kind}`;
      currentSymbolIds.add(symbolId);

      if (this.hasSymbolChanged(symbol, file.path)) {
        const cached = this.cacheData.symbolCaches.get(symbolId);
        if (cached) {
          modified.push(symbol);
        } else {
          added.push(symbol);
        }
      }
    }

    for (const [symbolId, cached] of this.cacheData.symbolCaches) {
      if (cached.filePath === file.path && !currentSymbolIds.has(symbolId)) {
        deleted.push({
          name: cached.symbolName,
          kind: cached.symbolKind,
          location: {
            file: cached.filePath,
            line: 0,
            endLine: 0,
          },
        } as CodeSymbol);
      }
    }

    return { added, modified, deleted };
  }

  invalidateFile(filePath: string): void {
    this.cacheData.fileCaches.delete(filePath);

    for (const [symbolId, cache] of this.cacheData.symbolCaches) {
      if (cache.filePath === filePath) {
        this.cacheData.symbolCaches.delete(symbolId);
      }
    }
  }

  invalidateAll(): void {
    this.cacheData.fileCaches.clear();
    this.cacheData.symbolCaches.clear();
    this.cacheData.stats = { hits: 0, misses: 0, totalRequests: 0 };
  }

  getStats(): { hits: number; misses: number; hitRate: number; totalRequests: number } {
    const { hits, misses, totalRequests } = this.cacheData.stats;
    return {
      hits,
      misses,
      hitRate: totalRequests > 0 ? hits / totalRequests : 0,
      totalRequests,
    };
  }

  getCacheSize(): { files: number; symbols: number } {
    return {
      files: this.cacheData.fileCaches.size,
      symbols: this.cacheData.symbolCaches.size,
    };
  }

  save(): void {
    const dir = path.dirname(this.cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const serializable = {
      version: this.cacheData.version,
      fileCaches: Array.from(this.cacheData.fileCaches.entries()),
      symbolCaches: Array.from(this.cacheData.symbolCaches.entries()),
      lastCleanup: this.cacheData.lastCleanup.toISOString(),
      stats: this.cacheData.stats,
    };

    fs.writeFileSync(this.cachePath, JSON.stringify(serializable, null, 2));
  }

  private loadCache(): HashCacheData {
    const defaultCache: HashCacheData = {
      version: '1.0.0',
      fileCaches: new Map(),
      symbolCaches: new Map(),
      lastCleanup: new Date(),
      stats: { hits: 0, misses: 0, totalRequests: 0 },
    };

    if (!fs.existsSync(this.cachePath)) {
      return defaultCache;
    }

    try {
      const content = fs.readFileSync(this.cachePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        version: data.version || '1.0.0',
        fileCaches: new Map(data.fileCaches || []),
        symbolCaches: new Map(data.symbolCaches || []),
        lastCleanup: new Date(data.lastCleanup || new Date()),
        stats: data.stats || { hits: 0, misses: 0, totalRequests: 0 },
      };
    } catch {
      return defaultCache;
    }
  }

  private maybeCleanup(): void {
    const now = Date.now();
    const lastCleanup = this.cacheData.lastCleanup.getTime();

    if (now - lastCleanup < 60 * 60 * 1000) {
      return;
    }

    const totalSize = this.cacheData.fileCaches.size + this.cacheData.symbolCaches.size;
    if (totalSize < this.maxCacheSize) {
      return;
    }

    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.maxCacheAge;

    for (const [key, cache] of this.cacheData.fileCaches) {
      if (now - cache.cachedAt.getTime() > maxAge) {
        this.cacheData.fileCaches.delete(key);
      }
    }

    for (const [key, cache] of this.cacheData.symbolCaches) {
      if (now - cache.cachedAt.getTime() > maxAge) {
        this.cacheData.symbolCaches.delete(key);
      }
    }

    this.cacheData.lastCleanup = new Date();
  }

  private quickHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  private computeSymbolHash(symbols: CodeSymbol[]): string {
    const symbolData = symbols
      .map(s => `${s.name}:${s.kind}:${s.signature || ''}:${s.description || ''}`)
      .sort()
      .join('|');
    return this.quickHash(symbolData);
  }
}
