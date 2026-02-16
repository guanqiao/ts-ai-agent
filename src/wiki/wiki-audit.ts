import * as fs from 'fs/promises';
import * as path from 'path';
import { WikiAuditLog, WikiAuditLogQuery, IWikiAudit } from './types';

export class WikiAudit implements IWikiAudit {
  private auditDir: string;
  private logs: WikiAuditLog[] = [];
  private maxMemoryLogs: number = 1000;

  constructor(projectPath: string) {
    this.auditDir = path.join(projectPath, '.wiki', 'audit');
    // Note: loadLogs is async and will be called lazily
  }

  private async ensureAuditDir(): Promise<void> {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }

  private getAuditFilePath(): string {
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    return path.join(this.auditDir, `audit-${yearMonth}.json`);
  }

  private async loadLogs(): Promise<void> {
    if (this.logs.length > 0) return; // Already loaded
    try {
      const auditFile = this.getAuditFilePath();
      const content = await fs.readFile(auditFile, 'utf-8');
      const parsed = JSON.parse(content) as WikiAuditLog[];
      this.logs = parsed.slice(-this.maxMemoryLogs);
    } catch {
      this.logs = [];
    }
  }

  private async saveLogs(): Promise<void> {
    await this.ensureAuditDir();
    const auditFile = this.getAuditFilePath();
    await fs.writeFile(auditFile, JSON.stringify(this.logs, null, 2), 'utf-8');
  }

  async log(
    action: WikiAuditLog['action'],
    data: Omit<WikiAuditLog, 'id' | 'performedAt' | 'action'>
  ): Promise<WikiAuditLog> {
    await this.loadLogs(); // Ensure logs are loaded

    const auditLog: WikiAuditLog = {
      ...data,
      id: this.generateId(),
      action,
      performedAt: new Date(),
    };

    this.logs.push(auditLog);

    if (this.logs.length > this.maxMemoryLogs) {
      this.logs = this.logs.slice(-this.maxMemoryLogs);
    }

    await this.saveLogs();

    return auditLog;
  }

  async query(query: WikiAuditLogQuery): Promise<WikiAuditLog[]> {
    await this.loadLogs(); // Ensure logs are loaded
    let results = [...this.logs];

    if (query.pageId) {
      results = results.filter((log) => log.pageId === query.pageId);
    }

    if (query.action) {
      results = results.filter((log) => log.action === query.action);
    }

    if (query.performedBy) {
      results = results.filter((log) => log.performedBy === query.performedBy);
    }

    if (query.startDate) {
      results = results.filter((log) => new Date(log.performedAt) >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((log) => new Date(log.performedAt) <= query.endDate!);
    }

    results.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

    const offset = query.offset || 0;
    const limit = query.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  async getRecentLogs(limit: number = 50): Promise<WikiAuditLog[]> {
    return this.query({ limit });
  }

  async getPageLogs(pageId: string, limit: number = 50): Promise<WikiAuditLog[]> {
    return this.query({ pageId, limit });
  }

  async exportLogs(startDate: Date, endDate: Date): Promise<WikiAuditLog[]> {
    return this.query({ startDate, endDate });
  }

  async getAllAuditFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.auditDir);
      return files
        .filter((f) => f.startsWith('audit-') && f.endsWith('.json'))
        .map((f) => path.join(this.auditDir, f));
    } catch {
      return [];
    }
  }

  async loadAllLogs(): Promise<WikiAuditLog[]> {
    const allLogs: WikiAuditLog[] = [];
    const files = await this.getAllAuditFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const logs = JSON.parse(content) as WikiAuditLog[];
        allLogs.push(...logs);
      } catch {
        // 跳过无法读取的文件
      }
    }

    allLogs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

    return allLogs;
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
