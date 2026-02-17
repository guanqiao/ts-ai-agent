import * as fs from 'fs';
import * as path from 'path';
import { Snapshot } from './types';

interface SnapshotIndexEntry {
  id: string;
  timestamp: number;
  commitHash: string;
  fileCount: number;
  symbolCount: number;
}

interface SnapshotIndexData {
  version: string;
  latestSnapshotId: string | null;
  snapshots: SnapshotIndexEntry[];
  lastUpdated: string;
}

export class SnapshotIndex {
  private indexPath: string;
  private indexData: SnapshotIndexData;
  private maxSnapshots: number;

  constructor(snapshotDir: string, maxSnapshots: number = 10) {
    this.indexPath = path.join(snapshotDir, 'snapshot-index.json');
    this.maxSnapshots = maxSnapshots;
    this.indexData = this.loadIndex();
  }

  getLatestSnapshotId(): string | null {
    return this.indexData.latestSnapshotId;
  }

  getLatestSnapshotInfo(): SnapshotIndexEntry | null {
    if (!this.indexData.latestSnapshotId) {
      return null;
    }
    return this.indexData.snapshots.find(
      s => s.id === this.indexData.latestSnapshotId
    ) || null;
  }

  getAllSnapshots(): SnapshotIndexEntry[] {
    return [...this.indexData.snapshots].sort((a, b) => b.timestamp - a.timestamp);
  }

  getSnapshotsByCommit(commitHash: string): SnapshotIndexEntry[] {
    return this.indexData.snapshots.filter(s => s.commitHash === commitHash);
  }

  addSnapshot(snapshot: Snapshot): void {
    const entry: SnapshotIndexEntry = {
      id: snapshot.id,
      timestamp: snapshot.timestamp.getTime(),
      commitHash: snapshot.commitHash,
      fileCount: snapshot.metadata.totalFiles,
      symbolCount: snapshot.metadata.totalSymbols,
    };

    const existingIndex = this.indexData.snapshots.findIndex(s => s.id === entry.id);
    if (existingIndex >= 0) {
      this.indexData.snapshots[existingIndex] = entry;
    } else {
      this.indexData.snapshots.push(entry);
    }

    this.indexData.snapshots.sort((a, b) => b.timestamp - a.timestamp);
    this.indexData.latestSnapshotId = this.indexData.snapshots[0]?.id || null;

    if (this.indexData.snapshots.length > this.maxSnapshots) {
      this.indexData.snapshots = this.indexData.snapshots.slice(0, this.maxSnapshots);
    }

    this.indexData.lastUpdated = new Date().toISOString();
    this.saveIndex();
  }

  removeSnapshot(snapshotId: string): boolean {
    const index = this.indexData.snapshots.findIndex(s => s.id === snapshotId);
    if (index < 0) {
      return false;
    }

    this.indexData.snapshots.splice(index, 1);

    if (this.indexData.latestSnapshotId === snapshotId) {
      this.indexData.latestSnapshotId = this.indexData.snapshots[0]?.id || null;
    }

    this.indexData.lastUpdated = new Date().toISOString();
    this.saveIndex();
    return true;
  }

  getSnapshotCount(): number {
    return this.indexData.snapshots.length;
  }

  getSnapshotIdsToDelete(keepCount?: number): string[] {
    const count = keepCount || this.maxSnapshots;
    if (this.indexData.snapshots.length <= count) {
      return [];
    }

    return this.indexData.snapshots.slice(count).map(s => s.id);
  }

  clear(): void {
    this.indexData = {
      version: '1.0.0',
      latestSnapshotId: null,
      snapshots: [],
      lastUpdated: new Date().toISOString(),
    };
    this.saveIndex();
  }

  private loadIndex(): SnapshotIndexData {
    const defaultIndex: SnapshotIndexData = {
      version: '1.0.0',
      latestSnapshotId: null,
      snapshots: [],
      lastUpdated: new Date().toISOString(),
    };

    if (!fs.existsSync(this.indexPath)) {
      return defaultIndex;
    }

    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      const data = JSON.parse(content) as SnapshotIndexData;

      if (!data.version || !Array.isArray(data.snapshots)) {
        return defaultIndex;
      }

      return data;
    } catch {
      return defaultIndex;
    }
  }

  private saveIndex(): void {
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.indexPath, JSON.stringify(this.indexData, null, 2));
  }
}
