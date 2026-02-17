import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ProgressSnapshot,
  ProgressPersistenceConfig,
  IProgressPersistence,
  GenerationPhase,
  GenerationStats,
  TimeEstimate,
} from './types';

const DEFAULT_CONFIG: ProgressPersistenceConfig = {
  enabled: true,
  saveIntervalMs: 1000,
  maxSnapshots: 10,
  storagePath: '.wiki/progress',
};

export class WikiProgressPersistence implements IProgressPersistence {
  private config: ProgressPersistenceConfig;
  private projectPath: string;
  private storageDir: string;
  private lastSaveTime: number = 0;
  private pendingSave: NodeJS.Timeout | null = null;

  constructor(projectPath: string, config?: Partial<ProgressPersistenceConfig>) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = path.join(projectPath, this.config.storagePath);
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async save(snapshot: ProgressSnapshot): Promise<void> {
    if (!this.config.enabled) return;

    const now = Date.now();
    if (now - this.lastSaveTime < this.config.saveIntervalMs) {
      if (this.pendingSave) {
        clearTimeout(this.pendingSave);
      }
      this.pendingSave = setTimeout(() => {
        this.doSave(snapshot);
      }, this.config.saveIntervalMs);
      return;
    }

    await this.doSave(snapshot);
  }

  private async doSave(snapshot: ProgressSnapshot): Promise<void> {
    this.lastSaveTime = Date.now();

    const snapshotWithChecksum = {
      ...snapshot,
      checksum: this.generateChecksum(snapshot),
    };

    const filePath = this.getSnapshotPath(snapshot.id);
    const tempPath = `${filePath}.tmp`;

    try {
      fs.writeFileSync(tempPath, JSON.stringify(snapshotWithChecksum, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);

      await this.cleanupOldSnapshots();
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  async load(projectPath: string): Promise<ProgressSnapshot | null> {
    const filePath = this.getSnapshotPathByProject(projectPath);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const snapshot = JSON.parse(content) as ProgressSnapshot;

      if (!this.validateChecksum(snapshot)) {
        console.warn('Progress snapshot checksum validation failed');
        return null;
      }

      return snapshot;
    } catch {
      return null;
    }
  }

  async listPending(): Promise<ProgressSnapshot[]> {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));

    const snapshots: ProgressSnapshot[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.storageDir, file), 'utf-8');
        const snapshot = JSON.parse(content) as ProgressSnapshot;
        if (this.validateChecksum(snapshot)) {
          snapshots.push(snapshot);
        }
      } catch {
        // ignore invalid files
      }
    }

    return snapshots.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async clear(projectPath: string): Promise<void> {
    const filePath = this.getSnapshotPathByProject(projectPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getLatest(projectPath: string): Promise<ProgressSnapshot | null> {
    const pending = await this.listPending();
    const projectSnapshots = pending.filter((s) => s.projectPath === projectPath);
    return projectSnapshots.length > 0 ? projectSnapshots[0] : null;
  }

  createSnapshot(
    phase: GenerationPhase,
    step: number,
    totalSteps: number,
    progress: number,
    stats: GenerationStats,
    timeEstimate: TimeEstimate
  ): ProgressSnapshot {
    return {
      id: this.generateId(),
      projectPath: this.projectPath,
      phase,
      step,
      totalSteps,
      progress,
      timestamp: new Date(),
      stats,
      timeEstimate,
      checksum: '',
    };
  }

  canResume(snapshot: ProgressSnapshot): boolean {
    if (!snapshot) return false;

    const snapshotTime = new Date(snapshot.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const isExpired = Date.now() - snapshotTime > maxAge;

    if (isExpired) return false;

    if (snapshot.phase === 'finalization' && snapshot.progress >= 95) {
      return false;
    }

    return true;
  }

  getResumePoint(snapshot: ProgressSnapshot): {
    phase: GenerationPhase;
    step: number;
    message: string;
  } {
    const phaseMessages: Record<GenerationPhase, string> = {
      initialization: 'Resuming from initialization...',
      analysis: 'Resuming architecture analysis...',
      generation: 'Resuming page generation...',
      finalization: 'Resuming finalization...',
    };

    return {
      phase: snapshot.phase,
      step: snapshot.step,
      message: phaseMessages[snapshot.phase],
    };
  }

  private getSnapshotPath(id: string): string {
    return path.join(this.storageDir, `progress-${id}.json`);
  }

  private getSnapshotPathByProject(projectPath: string): string {
    const projectId = crypto
      .createHash('md5')
      .update(projectPath)
      .digest('hex')
      .substring(0, 8);
    return path.join(this.storageDir, `progress-project-${projectId}.json`);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateChecksum(snapshot: Omit<ProgressSnapshot, 'checksum'>): string {
    const data = JSON.stringify({
      projectPath: snapshot.projectPath,
      phase: snapshot.phase,
      step: snapshot.step,
      progress: snapshot.progress,
      timestamp: snapshot.timestamp,
    });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private validateChecksum(snapshot: ProgressSnapshot): boolean {
    const { checksum, ...rest } = snapshot;
    const expectedChecksum = this.generateChecksum(rest);
    return checksum === expectedChecksum;
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const snapshots = await this.listPending();

    if (snapshots.length > this.config.maxSnapshots) {
      const toDelete = snapshots.slice(this.config.maxSnapshots);
      for (const snapshot of toDelete) {
        const filePath = this.getSnapshotPath(snapshot.id);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }

  dispose(): void {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }
  }
}

export function createProgressPersistence(
  projectPath: string,
  config?: Partial<ProgressPersistenceConfig>
): IProgressPersistence {
  return new WikiProgressPersistence(projectPath, config);
}
