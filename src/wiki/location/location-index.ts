import { FileLocation, SymbolLocation, ILocationIndex, LocationIndexEntry } from './types';

export class LocationIndex implements ILocationIndex {
  private entries: Map<string, LocationIndexEntry> = new Map();
  private fileIndex: Map<string, Set<string>> = new Map();
  private pageIndex: Map<string, Set<string>> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map();

  async indexLocation(location: FileLocation | SymbolLocation, linkId: string): Promise<void> {
    const entry = this.createEntry(location, linkId);
    this.entries.set(linkId, entry);

    this.addToIndex(this.fileIndex, this.normalizePath(location.filePath), linkId);

    if (this.isSymbolLocation(location)) {
      this.addToIndex(this.symbolIndex, location.symbolName, linkId);
    }
  }

  async removeLocation(linkId: string): Promise<void> {
    const entry = this.entries.get(linkId);
    if (!entry) return;

    this.removeFromIndex(this.fileIndex, this.normalizePath(entry.filePath), linkId);

    if (entry.symbolName) {
      this.removeFromIndex(this.symbolIndex, entry.symbolName, linkId);
    }

    if (entry.pageId) {
      this.removeFromIndex(this.pageIndex, entry.pageId, linkId);
    }

    this.entries.delete(linkId);
  }

  async queryByLocation(
    filePath: string,
    range?: { start: { line: number; column: number }; end: { line: number; column: number } }
  ): Promise<string[]> {
    const normalizedPath = this.normalizePath(filePath);
    const linkIds = this.fileIndex.get(normalizedPath);

    if (!linkIds) return [];

    if (!range) {
      return Array.from(linkIds);
    }

    const result: string[] = [];
    for (const id of linkIds) {
      const entry = this.entries.get(id);
      if (entry && entry.range && this.rangesOverlap(entry.range, range)) {
        result.push(id);
      }
    }

    return result;
  }

  async queryByPage(pageId: string): Promise<string[]> {
    const linkIds = this.pageIndex.get(pageId);
    return linkIds ? Array.from(linkIds) : [];
  }

  async queryBySymbol(symbolName: string): Promise<string[]> {
    const linkIds = this.symbolIndex.get(symbolName);
    return linkIds ? Array.from(linkIds) : [];
  }

  getEntry(linkId: string): LocationIndexEntry | null {
    return this.entries.get(linkId) || null;
  }

  getAllEntries(): LocationIndexEntry[] {
    return Array.from(this.entries.values());
  }

  indexByPage(pageId: string, linkId: string): void {
    this.addToIndex(this.pageIndex, pageId, linkId);
    const entry = this.entries.get(linkId);
    if (entry) {
      entry.pageId = pageId;
    }
  }

  clear(): void {
    this.entries.clear();
    this.fileIndex.clear();
    this.pageIndex.clear();
    this.symbolIndex.clear();
  }

  getStats(): { totalEntries: number; fileCount: number; symbolCount: number; pageCount: number } {
    return {
      totalEntries: this.entries.size,
      fileCount: this.fileIndex.size,
      symbolCount: this.symbolIndex.size,
      pageCount: this.pageIndex.size,
    };
  }

  private createEntry(location: FileLocation | SymbolLocation, linkId: string): LocationIndexEntry {
    return {
      linkId,
      filePath: location.filePath,
      range: location.range,
      symbolName: this.isSymbolLocation(location) ? location.symbolName : undefined,
      symbolKind: this.isSymbolLocation(location) ? location.kind : undefined,
      pageId: '',
    };
  }

  private isSymbolLocation(location: FileLocation | SymbolLocation): location is SymbolLocation {
    return 'symbolName' in location;
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  private addToIndex(map: Map<string, Set<string>>, key: string, value: string): void {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(value);
  }

  private removeFromIndex(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        map.delete(key);
      }
    }
  }

  private rangesOverlap(
    a: { start: { line: number; column: number }; end: { line: number; column: number } },
    b: { start: { line: number; column: number }; end: { line: number; column: number } }
  ): boolean {
    const aStart = a.start.line * 1000 + a.start.column;
    const aEnd = a.end.line * 1000 + a.end.column;
    const bStart = b.start.line * 1000 + b.start.column;
    const bEnd = b.end.line * 1000 + b.end.column;

    return aStart <= bEnd && aEnd >= bStart;
  }
}
