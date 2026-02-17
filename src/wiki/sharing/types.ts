import { WikiPage } from '../types';

export interface WikiSharingConfig {
  enabled: boolean;
  shareToGit: boolean;
  sharePath: string;
  accessControl: 'public' | 'team' | 'private';
  syncWithRemote: boolean;
  autoCommit: boolean;
  commitMessageTemplate: string;
  excludePatterns: string[];
  includePatterns: string[];
}

export interface ShareResult {
  success: boolean;
  message: string;
  sharedPath?: string;
  commitHash?: string;
  filesShared: number;
  timestamp: Date;
  errors: ShareError[];
}

export interface SyncResult {
  success: boolean;
  message: string;
  direction: 'push' | 'pull' | 'both';
  filesSynced: number;
  conflicts: Conflict[];
  timestamp: Date;
  errors: ShareSyncError[];
}

export interface ShareStatus {
  isShared: boolean;
  sharePath: string;
  lastSharedAt: Date | null;
  lastSyncedAt: Date | null;
  pendingChanges: boolean;
  remoteStatus: RemoteStatus;
  conflicts: Conflict[];
}

export interface RemoteStatus {
  connected: boolean;
  branch: string;
  ahead: number;
  behind: number;
  lastFetchAt: Date | null;
}

export interface Conflict {
  id: string;
  type: 'content' | 'delete-modify' | 'rename' | 'binary';
  filePath: string;
  localVersion: ConflictVersion;
  remoteVersion: ConflictVersion;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution: ResolutionStrategy;
  resolved: boolean;
  resolution?: ConflictResolution;
}

export interface ConflictVersion {
  content: string;
  hash: string;
  author: string;
  timestamp: Date;
  pageId?: string;
}

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedContent?: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export type ResolutionStrategy = 'keep-local' | 'keep-remote' | 'merge' | 'manual' | 'auto-merge';

export interface ShareError {
  code: string;
  message: string;
  filePath?: string;
  details?: Record<string, unknown>;
}

export interface ShareSyncError {
  code: string;
  message: string;
  filePath?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ShareableContent {
  pages: WikiPage[];
  metadata: ShareMetadata;
  manifest: ShareManifest;
}

export interface ShareMetadata {
  projectName: string;
  version: string;
  generatedAt: Date;
  generator: string;
  totalFiles: number;
  totalPages: number;
}

export interface ShareManifest {
  version: number;
  files: ManifestEntry[];
  checksums: Record<string, string>;
}

export interface ManifestEntry {
  path: string;
  type: 'page' | 'index' | 'metadata' | 'asset';
  hash: string;
  size: number;
  lastModified: Date;
}

export interface IWikiSharingService {
  initialize(config: WikiSharingConfig): Promise<void>;
  share(): Promise<ShareResult>;
  sync(): Promise<SyncResult>;
  getStatus(): Promise<ShareStatus>;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
  resolveConflicts(resolutions: Map<string, ConflictResolution>): Promise<void>;
  getConflicts(): Promise<Conflict[]>;
  pullFromRemote(): Promise<SyncResult>;
  pushToRemote(): Promise<SyncResult>;
  detectConflicts(): Promise<Conflict[]>;
  isConfigured(): boolean;
  isEnabled(): boolean;
}

export const DEFAULT_SHARING_CONFIG: WikiSharingConfig = {
  enabled: false,
  shareToGit: true,
  sharePath: '.tsdgen/wiki',
  accessControl: 'team',
  syncWithRemote: true,
  autoCommit: true,
  commitMessageTemplate: 'docs: update wiki documentation [skip ci]',
  excludePatterns: ['.wiki/**/*.tmp', '.wiki/**/*.bak', '.wiki/vectors/**'],
  includePatterns: ['**/*.md', '**/*.json'],
};
