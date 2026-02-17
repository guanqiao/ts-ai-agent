import * as fs from 'fs';
import * as path from 'path';
import { WikiProgressPersistence } from '../../src/wiki/wiki-progress-persistence';
import { ProgressSnapshot, GenerationPhase } from '../../src/wiki/types';

describe('WikiProgressPersistence', () => {
  let persistence: WikiProgressPersistence;
  const testStoragePath = path.join(__dirname, 'test-progress');

  beforeEach(() => {
    persistence = new WikiProgressPersistence(testStoragePath, {
      enabled: true,
      saveIntervalMs: 0,
      maxSnapshots: 5,
      storagePath: '.test-progress',
    });
  });

  afterEach(() => {
    persistence.dispose();
    const progressDir = path.join(testStoragePath, '.test-progress');
    if (fs.existsSync(progressDir)) {
      fs.rmSync(progressDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
  });

  const createTestSnapshot = (
    phase: GenerationPhase = 'generation',
    progress: number = 50
  ): ProgressSnapshot => {
    return persistence.createSnapshot(
      phase,
      5,
      10,
      progress,
      {
        totalFiles: 10,
        totalSymbols: 100,
        totalPages: 5,
        phases: [],
        startTime: new Date(),
        errors: [],
      },
      {
        elapsedMs: 5000,
        estimatedRemainingMs: 5000,
        estimatedTotalMs: 10000,
        averageSpeed: 1,
        phaseEstimates: [],
      }
    );
  };

  describe('save and load', () => {
    it('should save and load a progress snapshot', async () => {
      const snapshot = createTestSnapshot();

      await persistence.save(snapshot);

      const pending = await persistence.listPending();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].phase).toBe('generation');
      expect(pending[0].progress).toBe(50);
    });

    it('should return null when no snapshot exists', async () => {
      const loaded = await persistence.load('/non/existent/path');

      expect(loaded).toBeNull();
    });

    it('should validate checksum on load', async () => {
      const snapshot = createTestSnapshot();
      await persistence.save(snapshot);

      const filePath = path.join(
        testStoragePath,
        '.test-progress',
        `progress-${snapshot.id}.json`
      );
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        content.checksum = 'invalid-checksum';
        fs.writeFileSync(filePath, JSON.stringify(content));
      }

      const loaded = await persistence.load(testStoragePath);

      expect(loaded).toBeNull();
    });
  });

  describe('listPending', () => {
    it('should list all pending snapshots', async () => {
      const snapshot1 = createTestSnapshot('initialization', 10);
      const snapshot2 = createTestSnapshot('analysis', 30);
      const snapshot3 = createTestSnapshot('generation', 50);

      await persistence.save(snapshot1);
      await persistence.save(snapshot2);
      await persistence.save(snapshot3);

      const pending = await persistence.listPending();

      expect(pending.length).toBe(3);
    });

    it('should return empty array when no snapshots exist', async () => {
      const pending = await persistence.listPending();

      expect(pending).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear progress snapshot', async () => {
      const snapshot = createTestSnapshot();
      await persistence.save(snapshot);

      await persistence.clear(testStoragePath);

      const loaded = await persistence.load(testStoragePath);
      expect(loaded).toBeNull();
    });
  });

  describe('getLatest', () => {
    it('should return the most recent snapshot', async () => {
      const snapshot1 = createTestSnapshot('initialization', 10);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const snapshot2 = createTestSnapshot('generation', 50);

      await persistence.save(snapshot1);
      await persistence.save(snapshot2);

      const latest = await persistence.getLatest(testStoragePath);

      expect(latest?.progress).toBe(50);
    });
  });

  describe('createSnapshot', () => {
    it('should create a valid snapshot', () => {
      const snapshot = persistence.createSnapshot(
        'generation',
        5,
        10,
        50,
        {
          totalFiles: 10,
          totalSymbols: 100,
          totalPages: 5,
          phases: [],
          startTime: new Date(),
          errors: [],
        },
        {
          elapsedMs: 5000,
          estimatedRemainingMs: 5000,
          estimatedTotalMs: 10000,
          averageSpeed: 1,
          phaseEstimates: [],
        }
      );

      expect(snapshot.id).toBeDefined();
      expect(snapshot.phase).toBe('generation');
      expect(snapshot.step).toBe(5);
      expect(snapshot.totalSteps).toBe(10);
      expect(snapshot.progress).toBe(50);
      expect(snapshot.timestamp).toBeDefined();
    });
  });

  describe('canResume', () => {
    it('should return true for valid snapshot', () => {
      const snapshot = createTestSnapshot('generation', 50);
      snapshot.timestamp = new Date();

      const canResume = persistence.canResume(snapshot);

      expect(canResume).toBe(true);
    });

    it('should return false for expired snapshot', () => {
      const snapshot = createTestSnapshot('generation', 50);
      snapshot.timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);

      const canResume = persistence.canResume(snapshot);

      expect(canResume).toBe(false);
    });

    it('should return false for nearly complete finalization', () => {
      const snapshot = createTestSnapshot('finalization', 98);

      const canResume = persistence.canResume(snapshot);

      expect(canResume).toBe(false);
    });
  });

  describe('getResumePoint', () => {
    it('should return correct resume point', () => {
      const snapshot = createTestSnapshot('generation', 50);

      const resumePoint = persistence.getResumePoint(snapshot);

      expect(resumePoint.phase).toBe('generation');
      expect(resumePoint.step).toBe(5);
      expect(resumePoint.message).toContain('Resuming');
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should remove old snapshots when max is exceeded', async () => {
      for (let i = 0; i < 7; i++) {
        const snapshot = createTestSnapshot('generation', i * 10);
        await persistence.save(snapshot);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const pending = await persistence.listPending();

      expect(pending.length).toBeLessThanOrEqual(5);
    });
  });
});
