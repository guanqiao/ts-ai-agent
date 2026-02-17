import { WikiProgressMonitor } from '../../src/wiki/wiki-progress-monitor';
import { WikiProgressEvent, GenerationPhase } from '../../src/wiki/types';

describe('WikiProgressMonitor', () => {
  let monitor: WikiProgressMonitor;

  beforeEach(() => {
    monitor = new WikiProgressMonitor();
  });

  describe('start', () => {
    it('should initialize with correct values', () => {
      const progressEvents: WikiProgressEvent[] = [];
      monitor.on('progress', (event) => progressEvents.push(event));

      monitor.start(10, 'Starting...');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].type).toBe('generation-started');
      expect(progressEvents[0].phase).toBe('initialization');
    });

    it('should reset state on start', () => {
      monitor.start(10);
      monitor.updateProgress(5, 'Progress');

      monitor.start(20, 'Restarting...');

      const progress = monitor.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(20);
    });
  });

  describe('updateProgress', () => {
    it('should emit progress events', () => {
      const progressEvents: WikiProgressEvent[] = [];
      monitor.on('progress', (event) => progressEvents.push(event));

      monitor.start(10);
      monitor.updateProgress(5, 'Halfway');

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.current).toBe(5);
      expect(lastEvent.total).toBe(10);
      expect(lastEvent.message).toBe('Halfway');
    });

    it('should calculate progress percentage', () => {
      monitor.start(10);
      monitor.updateProgress(5, 'Halfway');

      const progress = monitor.getProgress();
      expect(progress.progress).toBeGreaterThan(0);
    });
  });

  describe('updatePhase', () => {
    it('should change phase correctly', () => {
      monitor.start(10);

      monitor.updatePhase('analysis', 20, 'Analyzing...');

      const progress = monitor.getProgress();
      expect(progress.phase).toBe('analysis');
    });

    it('should emit progress event on phase change', () => {
      const progressEvents: WikiProgressEvent[] = [];
      monitor.on('progress', (event) => progressEvents.push(event));

      monitor.start(10);
      monitor.updatePhase('generation', 30, 'Generating...');

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.phase).toBe('generation');
    });
  });

  describe('reportPageProgress', () => {
    it('should report page generation progress', () => {
      const progressEvents: WikiProgressEvent[] = [];
      monitor.on('progress', (event) => progressEvents.push(event));

      monitor.start(10);
      monitor.updatePhase('generation', 10);
      monitor.reportPageProgress(3, 10, 'Overview');

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.type).toBe('page-generating');
      expect(lastEvent.pageTitle).toBe('Overview');
    });
  });

  describe('complete', () => {
    it('should mark generation as complete', () => {
      const progressEvents: WikiProgressEvent[] = [];
      monitor.on('progress', (event) => progressEvents.push(event));
      const completeEvents: any[] = [];
      monitor.on('complete', (stats) => completeEvents.push(stats));

      monitor.start(10);
      monitor.updateProgress(10, 'Done');
      monitor.complete('Generation completed');

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.type).toBe('generation-completed');
      expect(completeEvents.length).toBe(1);
    });

    it('should record end time and duration', () => {
      monitor.start(10);
      monitor.complete('Done');

      const stats = monitor.getStats();
      expect(stats.endTime).toBeDefined();
      expect(stats.duration).toBeDefined();
      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error', () => {
    it('should record errors', () => {
      const errorEvents: any[] = [];
      monitor.on('error', (error) => errorEvents.push(error));

      monitor.start(10);
      monitor.updatePhase('generation', 10);
      monitor.error(new Error('Test error'), true);

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].message).toBe('Test error');
      expect(errorEvents[0].recoverable).toBe(true);
    });

    it('should add error to stats', () => {
      monitor.start(10);
      monitor.error(new Error('Test error'));

      const stats = monitor.getStats();
      expect(stats.errors.length).toBe(1);
    });
  });

  describe('getProgress', () => {
    it('should return current progress info', () => {
      monitor.start(10);
      monitor.updateProgress(5, 'Halfway');

      const progress = monitor.getProgress();
      expect(progress.current).toBe(5);
      expect(progress.total).toBe(10);
      expect(progress.percentage).toMatch(/\d+%/);
    });
  });

  describe('getStats', () => {
    it('should return generation statistics', () => {
      monitor.setTotalFiles(10);
      monitor.setTotalSymbols(50);
      monitor.setTotalPages(5);

      monitor.start(10);
      monitor.updateProgress(10, 'Done');
      monitor.complete('Completed');

      const stats = monitor.getStats();
      expect(stats.totalFiles).toBe(10);
      expect(stats.totalSymbols).toBe(50);
      expect(stats.totalPages).toBe(5);
      expect(stats.phases.length).toBe(4);
    });
  });

  describe('onProgress callback', () => {
    it('should call registered callbacks', () => {
      const callbackResults: any[] = [];
      monitor.onProgress((info) => callbackResults.push(info));

      monitor.start(10);
      monitor.updateProgress(5, 'Halfway');

      expect(callbackResults.length).toBeGreaterThan(0);
      expect(callbackResults[callbackResults.length - 1].current).toBe(5);
    });
  });

  describe('phase weights', () => {
    it('should calculate overall progress based on phase weights', () => {
      monitor.start(10);

      monitor.updatePhase('initialization', 1);
      monitor.updateProgress(1, 'Init done');

      let progress = monitor.getProgress();
      expect(progress.progress).toBeLessThan(10);

      monitor.updatePhase('analysis', 10);
      monitor.updateProgress(10, 'Analysis done');

      progress = monitor.getProgress();
      expect(progress.progress).toBeGreaterThan(5);
      expect(progress.progress).toBeLessThan(30);

      monitor.updatePhase('generation', 10);
      monitor.updateProgress(10, 'Generation done');

      progress = monitor.getProgress();
      expect(progress.progress).toBeGreaterThan(80);

      monitor.updatePhase('finalization', 5);
      monitor.updateProgress(5, 'Finalization done');

      progress = monitor.getProgress();
      expect(progress.progress).toBe(100);
    });
  });

  describe('incrementStep', () => {
    it('should increment step by 1', () => {
      monitor.start(10);
      monitor.updateProgress(3, 'Step 3');

      monitor.incrementStep('Step 4');

      const progress = monitor.getProgress();
      expect(progress.current).toBe(4);
    });
  });
});
