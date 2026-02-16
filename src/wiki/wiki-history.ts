import * as fs from 'fs/promises';
import * as path from 'path';
import { WikiPage, WikiPageVersion, WikiPageHistory, IWikiHistory } from './types';

export class WikiHistory implements IWikiHistory {
  private historyDir: string;

  constructor(projectPath: string) {
    this.historyDir = path.join(projectPath, '.wiki', 'history');
  }

  private async ensureHistoryDir(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }

  private getPageHistoryDir(pageId: string): string {
    return path.join(this.historyDir, pageId);
  }

  private getVersionFilePath(pageId: string, version: number): string {
    return path.join(this.getPageHistoryDir(pageId), `v${version}.json`);
  }

  private getHistoryMetaPath(pageId: string): string {
    return path.join(this.getPageHistoryDir(pageId), 'meta.json');
  }

  async saveVersion(
    page: WikiPage,
    changeSummary?: string,
    changedBy?: string
  ): Promise<WikiPageVersion> {
    await this.ensureHistoryDir();

    const pageHistoryDir = this.getPageHistoryDir(page.id);
    await fs.mkdir(pageHistoryDir, { recursive: true });

    const nextVersion = page.version;

    const versionData: WikiPageVersion = {
      version: nextVersion,
      pageId: page.id,
      title: page.title,
      content: page.content,
      metadata: { ...page.metadata },
      sections: [...page.sections],
      links: [...page.links],
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      changeSummary,
      changedBy,
    };

    const versionFilePath = this.getVersionFilePath(page.id, nextVersion);
    await fs.writeFile(versionFilePath, JSON.stringify(versionData, null, 2), 'utf-8');

    const historyMeta: WikiPageHistory = {
      pageId: page.id,
      versions: [],
      currentVersion: nextVersion,
    };

    const metaPath = this.getHistoryMetaPath(page.id);
    try {
      const existingMeta = await fs.readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(existingMeta) as WikiPageHistory;
      historyMeta.versions = parsed.versions;
    } catch {
      // 文件不存在，使用默认值
    }

    historyMeta.versions.push({
      version: nextVersion,
      pageId: page.id,
      title: page.title,
      content: page.content,
      metadata: { ...page.metadata },
      sections: [...page.sections],
      links: [...page.links],
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      changeSummary,
      changedBy,
    });

    historyMeta.currentVersion = nextVersion;

    await fs.writeFile(metaPath, JSON.stringify(historyMeta, null, 2), 'utf-8');

    return versionData;
  }

  async getVersion(pageId: string, version: number): Promise<WikiPageVersion | null> {
    try {
      const versionFilePath = this.getVersionFilePath(pageId, version);
      const content = await fs.readFile(versionFilePath, 'utf-8');
      return JSON.parse(content) as WikiPageVersion;
    } catch {
      return null;
    }
  }

  async getHistory(pageId: string): Promise<WikiPageHistory | null> {
    try {
      const metaPath = this.getHistoryMetaPath(pageId);
      const content = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(content) as WikiPageHistory;
    } catch {
      return null;
    }
  }

  async listVersions(pageId: string, limit?: number, offset?: number): Promise<WikiPageVersion[]> {
    const history = await this.getHistory(pageId);
    if (!history) {
      return [];
    }

    const versions = [...history.versions].sort((a, b) => b.version - a.version);

    const start = offset || 0;
    const end = limit ? start + limit : versions.length;

    return versions.slice(start, end);
  }

  async compareVersions(
    pageId: string,
    oldVersion: number,
    newVersion: number
  ): Promise<import('./types').WikiDiffResult> {
    const oldPage = await this.getVersion(pageId, oldVersion);
    const newPage = await this.getVersion(pageId, newVersion);

    if (!oldPage || !newPage) {
      throw new Error('Version not found');
    }

    const oldLines = oldPage.content.split('\n');
    const newLines = newPage.content.split('\n');

    const changes: import('./types').WikiDiffChange[] = [];
    let additions = 0;
    let deletions = 0;

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        changes.push({
          type: 'added',
          lineNumber: i + 1,
          newContent: newLine,
        });
        additions++;
      } else if (oldLine !== undefined && newLine === undefined) {
        changes.push({
          type: 'removed',
          lineNumber: i + 1,
          oldContent: oldLine,
        });
        deletions++;
      } else if (oldLine !== newLine) {
        changes.push({
          type: 'modified',
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: newLine,
        });
        additions++;
        deletions++;
      }
    }

    return {
      oldVersion,
      newVersion,
      additions,
      deletions,
      changes,
    };
  }

  async rollback(
    pageId: string,
    targetVersion: number,
    performedBy?: string
  ): Promise<WikiPage | null> {
    const targetPageVersion = await this.getVersion(pageId, targetVersion);
    if (!targetPageVersion) {
      return null;
    }

    const history = await this.getHistory(pageId);
    const currentVersion = history?.currentVersion || 1;
    const nextVersion = currentVersion + 1;

    const rolledBackPage: WikiPage = {
      id: targetPageVersion.pageId,
      title: targetPageVersion.title,
      slug: (targetPageVersion.metadata.custom?.slug as string) || targetPageVersion.pageId,
      content: targetPageVersion.content,
      format:
        (targetPageVersion.metadata.custom?.format as import('../types').DocumentFormat) ||
        'markdown',
      metadata: {
        ...targetPageVersion.metadata,
        custom: {
          ...targetPageVersion.metadata.custom,
          rolledBackFrom: targetVersion,
          rolledBackBy: performedBy,
        },
      },
      sections: targetPageVersion.sections,
      links: targetPageVersion.links,
      createdAt: targetPageVersion.createdAt,
      updatedAt: new Date(),
      version: nextVersion,
    };

    await this.saveVersion(rolledBackPage, `Rolled back to version ${targetVersion}`, performedBy);

    return rolledBackPage;
  }

  async deleteVersion(pageId: string, version: number): Promise<boolean> {
    try {
      const versionFilePath = this.getVersionFilePath(pageId, version);
      await fs.unlink(versionFilePath);

      const history = await this.getHistory(pageId);
      if (history) {
        history.versions = history.versions.filter((v) => v.version !== version);
        const metaPath = this.getHistoryMetaPath(pageId);
        await fs.writeFile(metaPath, JSON.stringify(history, null, 2), 'utf-8');
      }

      return true;
    } catch {
      return false;
    }
  }

  async cleanupOldVersions(pageId: string, keepCount: number): Promise<number> {
    const history = await this.getHistory(pageId);
    if (!history || history.versions.length <= keepCount) {
      return 0;
    }

    const sortedVersions = [...history.versions].sort((a, b) => b.version - a.version);
    const versionsToDelete = sortedVersions.slice(keepCount);

    let deletedCount = 0;
    for (const version of versionsToDelete) {
      if (await this.deleteVersion(pageId, version.version)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
