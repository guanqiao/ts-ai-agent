import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { GitService } from '../git';
import { IncrementalUpdater } from '../sync';
import {
  IWikiSyncMonitor,
  SyncStatus,
  OutdatedPage,
  ReminderConfig,
  ChangeImpact,
  SuggestedUpdate,
  WikiPage,
} from './types';

export class WikiSyncMonitor extends EventEmitter implements IWikiSyncMonitor {
  private projectPath: string;
  private gitService: GitService;
  private incrementalUpdater: IncrementalUpdater;
  private reminderInterval: NodeJS.Timeout | null = null;
  private reminderConfig: ReminderConfig | null = null;
  private syncedPages: Map<string, string> = new Map();

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.gitService = new GitService();
    this.incrementalUpdater = new IncrementalUpdater(
      path.join(projectPath, '.wiki', 'snapshots')
    );
  }

  async checkSyncStatus(): Promise<SyncStatus> {
    const outdatedPages = await this.getOutdatedPages();
    const snapshot = await this.incrementalUpdater.getLatestSnapshot();

    return {
      isSynced: outdatedPages.length === 0,
      lastSyncTime: snapshot?.timestamp || null,
      pendingChanges: outdatedPages.length,
      outdatedPages,
      errors: [],
    };
  }

  async getOutdatedPages(): Promise<OutdatedPage[]> {
    const outdatedPages: OutdatedPage[] = [];

    try {
      const isRepo = await this.gitService.isGitRepo(this.projectPath);
      if (!isRepo) return outdatedPages;

      const headCommit = await this.gitService.getHeadCommit(this.projectPath);
      const snapshot = await this.incrementalUpdater.getLatestSnapshot();

      if (!snapshot) {
        return outdatedPages;
      }

      if (snapshot.commitHash !== headCommit.hash) {
        const changedFiles = await this.gitService.getChangedFiles(
          this.projectPath,
          snapshot.commitHash
        );

        const wikiDir = path.join(this.projectPath, '.wiki', 'pages');
        if (fs.existsSync(wikiDir)) {
          const pageFiles = fs.readdirSync(wikiDir).filter((f) => f.endsWith('.json'));

          for (const pageFile of pageFiles) {
            const pagePath = path.join(wikiDir, pageFile);
            try {
              const content = fs.readFileSync(pagePath, 'utf-8');
              const page: WikiPage = JSON.parse(content);

              const affectedFiles = page.metadata.sourceFiles.filter((sourceFile) =>
                changedFiles.some(
                  (changedFile) =>
                    changedFile === sourceFile ||
                    sourceFile.startsWith(path.dirname(changedFile))
                )
              );

              if (affectedFiles.length > 0) {
                const severity = this.calculateSeverity(affectedFiles.length);

                outdatedPages.push({
                  pageId: page.id,
                  pageTitle: page.title,
                  lastSyncedCommit: snapshot.commitHash,
                  currentCommit: headCommit.hash,
                  changedFiles: affectedFiles,
                  outdatedSince: snapshot.timestamp,
                  severity,
                });
              }
            } catch {
              // Skip invalid page files
            }
          }
        }
      }
    } catch (error) {
      this.emit('error', error);
    }

    return outdatedPages;
  }

  scheduleReminders(config: ReminderConfig): void {
    this.reminderConfig = config;

    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }

    if (!config.enabled) {
      return;
    }

    this.reminderInterval = setInterval(async () => {
      const outdatedPages = await this.getOutdatedPages();

      if (outdatedPages.length > 0) {
        this.emit('reminder', { outdatedPages });

        switch (config.notificationType) {
          case 'console':
            console.log(`\n[Wiki Sync Monitor] ${outdatedPages.length} pages are outdated:`);
            outdatedPages.forEach((page) => {
              console.log(`  - ${page.pageTitle} (${page.severity})`);
            });
            break;

          case 'file':
            const logPath = path.join(this.projectPath, '.wiki', 'sync-alerts.log');
            const logEntry = `[${new Date().toISOString()}] ${outdatedPages.length} pages outdated\n`;
            fs.appendFileSync(logPath, logEntry);
            break;

          case 'callback':
            if (config.callback) {
              await config.callback(outdatedPages);
            }
            break;
        }
      }
    }, config.intervalMs);
  }

  cancelReminders(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    this.reminderConfig = null;
  }

  async getChangeImpact(filePath: string): Promise<ChangeImpact> {
    const affectedPages: string[] = [];
    const affectedModules: string[] = [];
    const suggestedUpdates: SuggestedUpdate[] = [];

    try {
      const wikiDir = path.join(this.projectPath, '.wiki', 'pages');
      if (fs.existsSync(wikiDir)) {
        const pageFiles = fs.readdirSync(wikiDir).filter((f) => f.endsWith('.json'));

        for (const pageFile of pageFiles) {
          const pagePath = path.join(wikiDir, pageFile);
          try {
            const content = fs.readFileSync(pagePath, 'utf-8');
            const page: WikiPage = JSON.parse(content);

            const isAffected = page.metadata.sourceFiles.some(
              (sourceFile) =>
                sourceFile === filePath ||
                filePath.startsWith(path.dirname(sourceFile))
            );

            if (isAffected) {
              affectedPages.push(page.id);

              const moduleName = path.dirname(filePath).split(path.sep).pop() || '';
              if (!affectedModules.includes(moduleName)) {
                affectedModules.push(moduleName);
              }

              for (const section of page.sections) {
                suggestedUpdates.push({
                  pageId: page.id,
                  section: section.title,
                  reason: `Source file ${filePath} may affect this section`,
                  priority: 'medium',
                });
              }
            }
          } catch {
            // Skip invalid page files
          }
        }
      }
    } catch (error) {
      this.emit('error', error);
    }

    return {
      affectedPages,
      affectedModules,
      suggestedUpdates,
    };
  }

  async markAsSynced(pageIds: string[]): Promise<void> {
    const headCommit = await this.gitService.getHeadCommit(this.projectPath);

    for (const pageId of pageIds) {
      this.syncedPages.set(pageId, headCommit.hash);
    }

    this.emit('pages-synced', { pageIds, commitHash: headCommit.hash });
  }

  private calculateSeverity(affectedFileCount: number): 'low' | 'medium' | 'high' {
    if (affectedFileCount >= 5) return 'high';
    if (affectedFileCount >= 2) return 'medium';
    return 'low';
  }

  getReminderConfig(): ReminderConfig | null {
    return this.reminderConfig;
  }

  isReminderActive(): boolean {
    return this.reminderInterval !== null;
  }

  async getSyncHealth(): Promise<{
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  }> {
    const status = await this.checkSyncStatus();
    const outdatedCount = status.outdatedPages.length;

    let score = 100;
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = 'All pages are up to date';

    if (outdatedCount > 0) {
      const highSeverity = status.outdatedPages.filter((p) => p.severity === 'high').length;
      const mediumSeverity = status.outdatedPages.filter((p) => p.severity === 'medium').length;

      score = Math.max(0, 100 - highSeverity * 20 - mediumSeverity * 10 - outdatedCount * 5);

      if (score < 50) {
        healthStatus = 'critical';
        message = `${outdatedCount} pages are outdated, including ${highSeverity} critical pages`;
      } else if (score < 80) {
        healthStatus = 'warning';
        message = `${outdatedCount} pages need to be updated`;
      } else {
        message = `${outdatedCount} pages have minor updates pending`;
      }
    }

    return { score, status: healthStatus, message };
  }
}
