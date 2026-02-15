import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { GitService } from './git-service';
import {
  IGitWatcher,
  GitWatcherOptions,
  GitWatcherCallback,
  GitWatcherEvent,
  GitCommit,
} from './types';

export class GitWatcher extends EventEmitter implements IGitWatcher {
  private repoPath: string;
  private gitService: GitService;
  private options: Required<GitWatcherOptions>;
  private watchInterval: NodeJS.Timeout | null = null;
  private callback: GitWatcherCallback | null = null;
  private lastHeadHash: string = '';
  private lastBranch: string = '';
  private isRunning: boolean = false;

  constructor(repoPath: string, options?: GitWatcherOptions) {
    super();
    this.repoPath = repoPath;
    this.gitService = new GitService();
    this.options = {
      debounceMs: options?.debounceMs ?? 1000,
      ignoreBranches: options?.ignoreBranches ?? [],
    };
  }

  async start(callback: GitWatcherCallback): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const isRepo = await this.gitService.isGitRepo(this.repoPath);
    if (!isRepo) {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }

    this.callback = callback;
    this.isRunning = true;

    const headCommit = await this.gitService.getHeadCommit(this.repoPath);
    this.lastHeadHash = headCommit.hash;
    this.lastBranch = await this.gitService.getCurrentBranch(this.repoPath);

    this.startWatching();
    this.startFsWatcher();
  }

  stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }

    this.isRunning = false;
    this.lastHeadHash = '';
    this.lastBranch = '';
    this.callback = null;
  }

  isWatching(): boolean {
    return this.isRunning;
  }

  private startWatching(): void {
    this.watchInterval = setInterval(async () => {
      try {
        await this.checkForChanges();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.options.debounceMs);
  }

  private startFsWatcher(): void {
    const gitDir = path.join(this.repoPath, '.git');
    const headFile = path.join(gitDir, 'HEAD');
    const refsDir = path.join(gitDir, 'refs', 'heads');

    const watchPaths = [headFile];
    if (fs.existsSync(refsDir)) {
      watchPaths.push(refsDir);
    }

    for (const watchPath of watchPaths) {
      if (fs.existsSync(watchPath)) {
        fs.watch(watchPath, { persistent: false }, async (eventType) => {
          if (eventType === 'change') {
            await this.checkForChanges();
          }
        });
      }
    }
  }

  private async checkForChanges(): Promise<void> {
    if (!this.callback) return;

    const currentBranch = await this.gitService.getCurrentBranch(this.repoPath);
    const currentCommit = await this.gitService.getHeadCommit(this.repoPath);

    if (this.options.ignoreBranches.includes(currentBranch)) {
      return;
    }

    if (currentCommit.hash !== this.lastHeadHash) {
      const changedFiles = await this.gitService.getChangedFiles(
        this.repoPath,
        this.lastHeadHash
      );

      const event: GitWatcherEvent = {
        type: 'head-change',
        commit: currentCommit,
        branch: currentBranch,
        changedFiles,
        timestamp: new Date(),
      };

      this.lastHeadHash = currentCommit.hash;

      await this.invokeCallback(event);
    }

    if (currentBranch !== this.lastBranch) {
      const event: GitWatcherEvent = {
        type: 'branch-change',
        commit: currentCommit,
        branch: currentBranch,
        timestamp: new Date(),
      };

      this.lastBranch = currentBranch;

      await this.invokeCallback(event);
    }
  }

  private async invokeCallback(event: GitWatcherEvent): Promise<void> {
    if (!this.callback) return;

    try {
      await this.callback(event);
      this.emit('event', event);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async waitForChange(timeoutMs: number = 60000): Promise<GitWatcherEvent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for git change'));
      }, timeoutMs);

      this.once('event', (event: GitWatcherEvent) => {
        clearTimeout(timeout);
        resolve(event);
      });

      this.once('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  getLastCommit(): GitCommit | null {
    if (!this.lastHeadHash) return null;
    return {
      hash: this.lastHeadHash,
      shortHash: this.lastHeadHash.substring(0, 7),
      message: '',
      author: '',
      authorEmail: '',
      date: new Date(),
      parentHashes: [],
    };
  }

  getCurrentBranch(): string {
    return this.lastBranch;
  }
}
