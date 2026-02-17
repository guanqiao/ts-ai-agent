import * as path from 'path';
import * as fs from 'fs';
import {
  InteractionRecord,
  InteractionType,
  InteractionQuery,
  InteractionStats,
  InteractionHistoryConfig,
} from './interaction-types';

const DEFAULT_CONFIG: InteractionHistoryConfig = {
  maxRecords: 10000,
  retentionDays: 30,
  enableContextSnapshot: true,
};

export class InteractionHistory {
  private _projectPath: string;
  private config: InteractionHistoryConfig;
  private records: InteractionRecord[] = [];
  private storagePath: string;

  constructor(projectPath: string, config?: Partial<InteractionHistoryConfig>) {
    this._projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storagePath = path.join(projectPath, '.wiki', 'interaction-history.json');
    this.loadFromDisk();
  }

  get projectPath(): string {
    return this._projectPath;
  }

  async record(record: Omit<InteractionRecord, 'id' | 'timestamp'>): Promise<InteractionRecord> {
    const fullRecord: InteractionRecord = {
      ...record,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.records.unshift(fullRecord);

    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(0, this.config.maxRecords);
    }

    await this.saveToDisk();

    return fullRecord;
  }

  async query(query: InteractionQuery): Promise<InteractionRecord[]> {
    let results = [...this.records];

    if (query.type !== undefined) {
      results = results.filter((r) => r.type === query.type);
    }

    if (query.startDate) {
      results = results.filter((r) => r.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((r) => r.timestamp <= query.endDate!);
    }

    if (query.sessionId !== undefined) {
      results = results.filter((r) => r.sessionId === query.sessionId);
    }

    if (query.success !== undefined) {
      results = results.filter((r) => r.metadata.success === query.success);
    }

    if (query.offset) {
      results = results.slice(query.offset);
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getRecent(limit: number = 10): Promise<InteractionRecord[]> {
    return this.records.slice(0, limit);
  }

  async getContext(query: string): Promise<InteractionRecord[]> {
    const lowerQuery = query.toLowerCase();
    const keywords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    return this.records
      .filter((record) => {
        const inputMatch = keywords.some((k) => record.input.toLowerCase().includes(k));
        const outputMatch = keywords.some((k) => record.output.toLowerCase().includes(k));
        return inputMatch || outputMatch;
      })
      .slice(0, 5);
  }

  async getStats(): Promise<InteractionStats> {
    const byType: Record<InteractionType, number> = {} as Record<InteractionType, number>;

    for (const type of Object.values(InteractionType)) {
      byType[type] = this.records.filter((r) => r.type === type).length;
    }

    const successCount = this.records.filter((r) => r.metadata.success).length;
    const totalTokens = this.records.reduce((sum, r) => sum + (r.metadata.tokensUsed || 0), 0);

    const toolUsage = new Map<string, number>();
    for (const record of this.records) {
      if (record.metadata.toolName) {
        const count = toolUsage.get(record.metadata.toolName) || 0;
        toolUsage.set(record.metadata.toolName, count + 1);
      }
    }

    const mostUsedTools = Array.from(toolUsage.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalInteractions: this.records.length,
      byType,
      successRate: this.records.length > 0 ? successCount / this.records.length : 0,
      totalTokensUsed: totalTokens,
      mostUsedTools,
    };
  }

  async clear(): Promise<void> {
    this.records = [];
    await this.saveToDisk();
  }

  async export(): Promise<string> {
    return JSON.stringify(this.records, null, 2);
  }

  async replay(limit: number = 10): Promise<InteractionRecord[]> {
    return this.records.slice(0, limit);
  }

  async findSimilar(query: string): Promise<InteractionRecord[]> {
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    const scored = this.records.map((record) => {
      const inputWords = record.input.toLowerCase().split(/\s+/);
      const outputWords = record.output.toLowerCase().split(/\s+/);

      let score = 0;
      for (const qw of queryWords) {
        for (const iw of inputWords) {
          if (iw.includes(qw) || qw.includes(iw)) {
            score += 2;
          }
          if (iw === qw) {
            score += 3;
          }
        }
        for (const ow of outputWords) {
          if (ow.includes(qw) || qw.includes(ow)) {
            score += 1;
          }
        }
      }

      return { record, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.record);
  }

  private generateId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.records = parsed.map((r: InteractionRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp),
        }));
      }
    } catch {
      this.records = [];
    }
  }

  private async saveToDisk(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(this.records, null, 2));
  }
}
