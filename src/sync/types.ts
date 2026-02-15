import { ParsedFile, CodeSymbol } from '../types';

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface FileChange {
  path: string;
  oldPath?: string;
  changeType: ChangeType;
  oldContent?: string;
  newContent?: string;
  diff?: string;
  symbols: {
    added: CodeSymbol[];
    modified: CodeSymbol[];
    deleted: CodeSymbol[];
  };
}

export interface ChangeSet {
  files: FileChange[];
  timestamp: Date;
  baseCommit: string;
  headCommit: string;
  summary: ChangeSummary;
}

export interface ChangeSummary {
  totalFiles: number;
  addedFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  renamedFiles: number;
  totalSymbols: number;
  addedSymbols: number;
  modifiedSymbols: number;
  deletedSymbols: number;
}

export interface SyncResult {
  success: boolean;
  updatedPages: string[];
  addedPages: string[];
  deletedPages: string[];
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  file: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface Snapshot {
  id: string;
  timestamp: Date;
  commitHash: string;
  files: SnapshotFile[];
  metadata: SnapshotMetadata;
}

export interface SnapshotFile {
  path: string;
  hash: string;
  symbolCount: number;
  lastModified: Date;
}

export interface SnapshotMetadata {
  totalFiles: number;
  totalSymbols: number;
  generator: string;
  version: string;
}

export interface IChangeDetector {
  detect(
    oldFiles: ParsedFile[],
    newFiles: ParsedFile[]
  ): ChangeSet;
  detectFileChange(
    oldFile: ParsedFile | null,
    newFile: ParsedFile | null
  ): FileChange | null;
  compareSymbols(
    oldSymbols: CodeSymbol[],
    newSymbols: CodeSymbol[]
  ): { added: CodeSymbol[]; modified: CodeSymbol[]; deleted: CodeSymbol[] };
}

export interface IIncrementalUpdater {
  update(
    changeSet: ChangeSet,
    existingDocument: string
  ): Promise<string>;
  mergeContent(
    oldContent: string,
    newContent: string,
    changeType: ChangeType
  ): string;
  createSnapshot(files: ParsedFile[], commitHash: string): Snapshot;
  loadSnapshot(snapshotId: string): Promise<Snapshot | null>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
}

export interface SyncOptions {
  forceFullUpdate?: boolean;
  includeUntracked?: boolean;
  excludePatterns?: string[];
  maxFileSize?: number;
}

export interface SyncContext {
  projectPath: string;
  outputPath: string;
  lastSyncCommit?: string;
  currentCommit: string;
  options: SyncOptions;
}
