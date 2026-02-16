import { EventEmitter } from 'events';
import { GitWatcher, GitService } from '../git';
import { IncrementalUpdater } from '../sync';
import { IWikiAutoSync, AutoSyncConfig, SyncStatus, SyncError, OutdatedPage } from './types';

export class WikiAutoSync extends EventEmitter implements IWikiAutoSync {
  private projectPath: string;
  private config: AutoSyncConfig | null = null;
  private gitWatcher: GitWatcher | null = null;
  private gitService: GitService;
  private incrementalUpdater: IncrementalUpdater;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingSync: boolean = false;
  private lastSyncTime: Date | null = null;
  private errors: SyncError[] = [];
  private running: boolean = false;

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.gitService = new GitService();
    this.incrementalUpdater = new IncrementalUpdater(`${projectPath}/.wiki/snapshots`);
  }

  async start(config: AutoSyncConfig): Promise<void> {
    if (this.running) {
      return;
    }

    this.config = config;
    this.running = true;
    this.errors = [];

    if (config.onProjectOpen) {
      await this.performInitialSync();
    }

    if (config.onGitChange) {
      await this.startGitWatcher();
    }

    if (config.backgroundMode) {
      this.startBackgroundSync();
    }

    this.emit('started', { config });
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.gitWatcher) {
      this.gitWatcher.stop();
      this.gitWatcher = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.running = false;
    this.emit('stopped');
  }

  getStatus(): SyncStatus {
    return {
      isSynced: this.errors.length === 0 && !this.pendingSync,
      lastSyncTime: this.lastSyncTime,
      pendingChanges: this.pendingSync ? 1 : 0,
      outdatedPages: [],
      errors: this.errors,
    };
  }

  async forceSync(): Promise<void> {
    await this.performSync();
  }

  isRunning(): boolean {
    return this.running;
  }

  private async performInitialSync(): Promise<void> {
    this.emit('sync-started', { type: 'initial' });

    try {
      const isRepo = await this.gitService.isGitRepo(this.projectPath);

      if (isRepo) {
        const headCommit = await this.gitService.getHeadCommit(this.projectPath);
        const snapshot = await this.incrementalUpdater.getLatestSnapshot();

        if (!snapshot || snapshot.commitHash !== headCommit.hash) {
          await this.performSync();
        } else {
          this.lastSyncTime = snapshot.timestamp;
          this.emit('sync-skipped', { reason: 'already-synced' });
        }
      } else {
        await this.performSync();
      }
    } catch (error) {
      this.addError('initial-sync-failed', error instanceof Error ? error.message : String(error));
      this.emit('sync-error', { error });
    }
  }

  private async startGitWatcher(): Promise<void> {
    const isRepo = await this.gitService.isGitRepo(this.projectPath);
    if (!isRepo) {
      this.addError('not-a-git-repo', 'Project is not a git repository');
      return;
    }

    this.gitWatcher = new GitWatcher(this.projectPath, {
      debounceMs: this.config?.debounceMs || 2000,
    });

    await this.gitWatcher.start(async (event) => {
      if (event.type === 'head-change') {
        this.emit('change-detected', { event });
        await this.debouncedSync();
      }
    });

    this.emit('watcher-started');
  }

  private startBackgroundSync(): void {
    const intervalMs = this.config?.debounceMs || 60000;

    this.syncInterval = setInterval(async () => {
      await this.checkForUpdates();
    }, intervalMs);
  }

  private async checkForUpdates(): Promise<void> {
    try {
      const isRepo = await this.gitService.isGitRepo(this.projectPath);
      if (!isRepo) return;

      const headCommit = await this.gitService.getHeadCommit(this.projectPath);
      const snapshot = await this.incrementalUpdater.getLatestSnapshot();

      if (!snapshot || snapshot.commitHash !== headCommit.hash) {
        this.emit('updates-available', {
          currentCommit: headCommit.hash,
          lastSyncedCommit: snapshot?.commitHash,
        });

        if (this.config?.notifyOnOutdated) {
          this.emit('outdated-notification', {
            message: 'Wiki documentation is outdated. Run sync to update.',
          });
        }
      }
    } catch (error) {
      this.addError('check-updates-failed', error instanceof Error ? error.message : String(error));
    }
  }

  private debounceTimer: NodeJS.Timeout | null = null;

  private async debouncedSync(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.performSync();
      this.debounceTimer = null;
    }, this.config?.debounceMs || 1000);
  }

  private async performSync(): Promise<void> {
    if (this.pendingSync) {
      return;
    }

    this.pendingSync = true;
    this.emit('sync-started', { type: 'incremental' });

    try {
      const headCommit = await this.gitService.getHeadCommit(this.projectPath);
      const snapshot = await this.incrementalUpdater.getLatestSnapshot();

      if (snapshot && snapshot.commitHash !== headCommit.hash) {
        const changedFiles = await this.gitService.getChangedFiles(
          this.projectPath,
          snapshot.commitHash
        );

        this.emit('sync-progress', {
          changedFiles,
          totalFiles: changedFiles.length,
        });

        this.lastSyncTime = new Date();
        this.emit('sync-completed', {
          commitHash: headCommit.hash,
          changedFiles: changedFiles.length,
        });
      } else {
        this.lastSyncTime = new Date();
        this.emit('sync-completed', { commitHash: headCommit.hash, changedFiles: 0 });
      }

      this.errors = [];
    } catch (error) {
      this.addError('sync-failed', error instanceof Error ? error.message : String(error));
      this.emit('sync-error', { error });
    } finally {
      this.pendingSync = false;
    }
  }

  private addError(code: string, message: string): void {
    this.errors.push({
      code,
      message,
      timestamp: new Date(),
    });

    if (this.errors.length > 10) {
      this.errors.shift();
    }
  }

  async getOutdatedPages(): Promise<OutdatedPage[]> {
    const outdatedPages: OutdatedPage[] = [];

    try {
      const isRepo = await this.gitService.isGitRepo(this.projectPath);
      if (!isRepo) return outdatedPages;

      const headCommit = await this.gitService.getHeadCommit(this.projectPath);
      const snapshot = await this.incrementalUpdater.getLatestSnapshot();

      if (snapshot && snapshot.commitHash !== headCommit.hash) {
        const changedFiles = await this.gitService.getChangedFiles(
          this.projectPath,
          snapshot.commitHash
        );

        for (const file of changedFiles) {
          outdatedPages.push({
            pageId: file,
            pageTitle: file.split('/').pop() || file,
            lastSyncedCommit: snapshot.commitHash,
            currentCommit: headCommit.hash,
            changedFiles: [file],
            outdatedSince: snapshot.timestamp,
            severity: 'medium',
          });
        }
      }
    } catch (error) {
      this.addError('get-outdated-failed', error instanceof Error ? error.message : String(error));
    }

    return outdatedPages;
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  getErrors(): SyncError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }
}
