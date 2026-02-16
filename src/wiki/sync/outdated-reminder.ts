import { IWikiStorage } from '../types';
import { GitService } from '../../git';

export interface OutdatedDoc {
  pageId: string;
  pageTitle: string;
  outdatedDays: number;
  changeCount: number;
  priority: number;
  type: 'outdated-documentation' | 'missing-documentation' | 'inconsistent-documentation';
  lastDocUpdate: Date;
  lastCodeChange: Date;
}

export interface ReminderPreferences {
  enabled: boolean;
  threshold: number;
  excludePatterns?: string[];
  priorityThreshold?: number;
}

export interface OutdatedCheck {
  pageId: string;
  outdatedDays: number;
  changeCount: number;
}

const DEFAULT_PREFERENCES: ReminderPreferences = {
  enabled: true,
  threshold: 7,
  priorityThreshold: 0.5,
};

export class OutdatedReminder {
  private wikiStorage: IWikiStorage;
  private gitService: GitService;
  private preferences: ReminderPreferences;

  constructor(wikiStorage: IWikiStorage, gitService: GitService) {
    this.wikiStorage = wikiStorage;
    this.gitService = gitService;
    this.preferences = { ...DEFAULT_PREFERENCES };
  }

  async detectOutdatedDocs(): Promise<OutdatedDoc[]> {
    const outdated: OutdatedDoc[] = [];

    try {
      const pages = await this.wikiStorage.listPages();

      for (const page of pages) {
        const sourceFiles = page.metadata?.sourceFiles as string[] | undefined;

        if (!sourceFiles || sourceFiles.length === 0) {
          continue;
        }

        let latestCodeChange: Date | null = null;
        let changeCount = 0;

        for (const file of sourceFiles) {
          try {
            const history = await this.gitService.getCommits(this.wikiStorage as any, {
              filePath: file,
              maxCount: 10,
            });

            if (history && history.length > 0) {
              changeCount += history.length;

              const latestCommit = history[0];
              if (latestCommit && latestCommit.date) {
                if (!latestCodeChange || latestCommit.date > latestCodeChange) {
                  latestCodeChange = latestCommit.date;
                }
              }
            }
          } catch {
            continue;
          }
        }

        if (latestCodeChange) {
          const docUpdate = page.updatedAt;
          const outdatedDays = Math.floor(
            (latestCodeChange.getTime() - docUpdate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (outdatedDays > 0) {
            const priority = this.calculateOutdatedScore(docUpdate, changeCount);

            outdated.push({
              pageId: page.id,
              pageTitle: page.title,
              outdatedDays,
              changeCount,
              priority,
              type: 'outdated-documentation',
              lastDocUpdate: docUpdate,
              lastCodeChange: latestCodeChange,
            });
          }
        }
      }
    } catch {
      return outdated;
    }

    return outdated.sort((a, b) => b.priority - a.priority);
  }

  calculateOutdatedScore(lastUpdate: Date, changeCount: number): number {
    const now = new Date();
    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const timeScore = Math.min(daysSinceUpdate / 90, 1) * 0.5;
    const changeScore = Math.min(changeCount / 20, 1) * 0.5;

    return timeScore + changeScore;
  }

  async generateReminders(): Promise<OutdatedDoc[]> {
    if (!this.preferences.enabled) {
      return [];
    }

    const outdated = await this.detectOutdatedDocs();

    return outdated.filter((doc) => {
      const threshold = this.preferences.priorityThreshold || 0.5;
      return doc.priority >= threshold;
    });
  }

  getUserPreferences(): ReminderPreferences {
    return { ...this.preferences };
  }

  setUserPreferences(prefs: Partial<ReminderPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...prefs,
    };
  }

  shouldRemind(check: OutdatedCheck): boolean {
    if (!this.preferences.enabled) {
      return false;
    }

    return check.outdatedDays >= this.preferences.threshold;
  }

  formatReminder(reminder: OutdatedDoc): string {
    const lines = [
      `📚 Documentation Update Reminder`,
      ``,
      `**${reminder.pageTitle}** needs attention:`,
      ``,
      `- Last documentation update: ${reminder.lastDocUpdate.toLocaleDateString()}`,
      `- Last code change: ${reminder.lastCodeChange.toLocaleDateString()}`,
      `- Days outdated: ${reminder.outdatedDays}`,
      `- Code changes since update: ${reminder.changeCount}`,
      `- Priority score: ${(reminder.priority * 100).toFixed(0)}%`,
      ``,
      `Consider updating the documentation to reflect recent code changes.`,
    ];

    return lines.join('\n');
  }
}
