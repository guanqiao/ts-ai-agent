export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  parentHashes: string[];
}

export interface GitDiff {
  filePath: string;
  oldPath?: string;
  newPath?: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
}

export interface BlameInfo {
  line: number;
  content: string;
  commit: GitCommit;
}

export interface GitLogOptions {
  maxCount?: number;
  since?: Date;
  until?: Date;
  author?: string;
  filePath?: string;
}

export interface GitDiffOptions {
  staged?: boolean;
  filePath?: string;
  since?: string;
  until?: string;
}

export interface GitWatcherOptions {
  debounceMs?: number;
  ignoreBranches?: string[];
}

export interface GitWatcherEvent {
  type: 'head-change' | 'branch-change' | 'file-change';
  commit?: GitCommit;
  branch?: string;
  changedFiles?: string[];
  timestamp: Date;
}

export type GitWatcherCallback = (event: GitWatcherEvent) => void | Promise<void>;

export interface IGitService {
  isGitRepo(path: string): Promise<boolean>;
  getRepoRoot(path: string): Promise<string>;
  getCurrentBranch(path: string): Promise<string>;
  getHeadCommit(path: string): Promise<GitCommit>;
  getCommits(path: string, options?: GitLogOptions): Promise<GitCommit[]>;
  getChangedFiles(path: string, since?: string): Promise<string[]>;
  getDiff(path: string, options?: GitDiffOptions): Promise<GitDiff[]>;
  getFileDiff(path: string, filePath: string, since?: string): Promise<GitDiff>;
  getBlame(path: string, filePath: string): Promise<BlameInfo[]>;
  getStatus(path: string): Promise<GitStatus>;
}

export interface IGitWatcher {
  start(callback: GitWatcherCallback): void;
  stop(): void;
  isWatching(): boolean;
}
