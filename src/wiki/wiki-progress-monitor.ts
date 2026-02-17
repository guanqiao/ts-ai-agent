import { EventEmitter } from 'events';
import {
  WikiProgressEvent,
  ProgressInfo,
  ProgressCallback,
  GenerationPhase,
  ProgressEventType,
  GenerationStats,
  PhaseStats,
  GenerationError,
} from './types';

export interface IWikiProgressMonitor {
  start(totalSteps: number, message?: string): void;
  updateProgress(step: number, message: string, details?: Record<string, unknown>): void;
  updatePhase(phase: GenerationPhase, totalSteps: number, message?: string): void;
  complete(message?: string): void;
  error(error: Error, recoverable?: boolean): void;
  getProgress(): ProgressInfo;
  getStats(): GenerationStats;
  onProgress(callback: ProgressCallback): void;
  on(event: 'progress' | 'error' | 'complete', listener: (...args: any[]) => void): this;
  setTotalFiles(count: number): void;
  setTotalSymbols(count: number): void;
  setTotalPages(count: number): void;
  reportPageProgress(currentPage: number, totalPages: number, pageTitle?: string): void;
}

const PHASE_WEIGHTS: Record<GenerationPhase, number> = {
  initialization: 5,
  analysis: 20,
  generation: 60,
  finalization: 15,
};

const PHASE_MESSAGES: Record<GenerationPhase, string> = {
  initialization: 'Initializing...',
  analysis: 'Analyzing architecture...',
  generation: 'Generating pages...',
  finalization: 'Finalizing...',
};

export class WikiProgressMonitor extends EventEmitter implements IWikiProgressMonitor {
  private currentPhase: GenerationPhase = 'initialization';
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private startTime: Date = new Date();
  private endTime?: Date;
  private errors: GenerationError[] = [];
  private phaseStats: PhaseStats[] = [];
  private progressCallbacks: ProgressCallback[] = [];
  private totalFiles: number = 0;
  private totalSymbols: number = 0;
  private totalPages: number = 0;

  constructor() {
    super();
    this.initializePhaseStats();
  }

  private initializePhaseStats(): void {
    const phases: GenerationPhase[] = ['initialization', 'analysis', 'generation', 'finalization'];
    for (const phase of phases) {
      this.phaseStats.push({
        phase,
        startTime: new Date(),
        itemsProcessed: 0,
        totalItems: 0,
      });
    }
  }

  start(totalSteps: number, message?: string): void {
    this.startTime = new Date();
    this.currentStep = 0;
    this.totalSteps = totalSteps;
    this.currentPhase = 'initialization';
    this.errors = [];

    this.emitProgressEvent('generation-started', message || PHASE_MESSAGES.initialization);
    this.updatePhaseStats('initialization', totalSteps);
  }

  updateProgress(step: number, message: string, details?: Record<string, unknown>): void {
    this.currentStep = step;

    this.emitProgressEvent(this.getProgressEventType(), message, details);
    this.notifyProgressCallbacks();
  }

  updatePhase(phase: GenerationPhase, totalSteps: number, message?: string): void {
    if (this.currentPhase !== phase) {
      this.finalizeCurrentPhase();
      this.currentPhase = phase;
      this.currentStep = 0;
      this.totalSteps = totalSteps;
      this.updatePhaseStats(phase, totalSteps);
    }

    this.emitProgressEvent(this.getProgressEventType(), message || PHASE_MESSAGES[phase]);
    this.notifyProgressCallbacks();
  }

  complete(message?: string): void {
    this.endTime = new Date();
    this.finalizeCurrentPhase();

    const stats = this.getStats();
    this.emitProgressEvent('generation-completed', message || 'Generation completed', {
      stats,
    });

    this.emit('complete', stats);
    this.notifyProgressCallbacks();
  }

  error(error: Error, recoverable: boolean = false): void {
    const genError: GenerationError = {
      phase: this.currentPhase,
      message: error.message,
      timestamp: new Date(),
      recoverable,
      details: { stack: error.stack },
    };

    this.errors.push(genError);
    this.emitProgressEvent('generation-error', error.message, { error: genError });
    this.emit('error', genError);
  }

  getProgress(): ProgressInfo {
    const overallProgress = this.calculateOverallProgress();
    return {
      phase: this.currentPhase,
      progress: overallProgress,
      current: this.currentStep,
      total: this.totalSteps,
      message: PHASE_MESSAGES[this.currentPhase],
      percentage: `${Math.round(overallProgress)}%`,
    };
  }

  getStats(): GenerationStats {
    return {
      totalFiles: this.totalFiles,
      totalSymbols: this.totalSymbols,
      totalPages: this.totalPages,
      phases: this.phaseStats,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime.getTime() - this.startTime.getTime() : undefined,
      errors: this.errors,
    };
  }

  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  setTotalFiles(count: number): void {
    this.totalFiles = count;
  }

  setTotalSymbols(count: number): void {
    this.totalSymbols = count;
  }

  setTotalPages(count: number): void {
    this.totalPages = count;
  }

  incrementStep(message: string, details?: Record<string, unknown>): void {
    this.updateProgress(this.currentStep + 1, message, details);
  }

  reportPageProgress(currentPage: number, totalPages: number, pageTitle?: string): void {
    this.totalSteps = totalPages;
    this.currentStep = currentPage;
    this.currentPhaseProgress = this.calculatePhaseProgress(currentPage, totalPages);

    const message = pageTitle
      ? `Generating page ${currentPage}/${totalPages}: ${pageTitle}`
      : `Generating page ${currentPage}/${totalPages}`;

    this.emitProgressEvent('page-generating', message, { pageTitle });
    this.updateCurrentPhaseStats(currentPage);
    this.notifyProgressCallbacks();
  }

  private calculateOverallProgress(): number {
    let completedWeight = 0;

    for (const stats of this.phaseStats) {
      if (stats.endTime) {
        completedWeight += PHASE_WEIGHTS[stats.phase];
      } else if (stats.phase === this.currentPhase) {
        const phaseProgress = stats.totalItems > 0 
          ? stats.itemsProcessed / stats.totalItems 
          : 0;
        completedWeight += PHASE_WEIGHTS[stats.phase] * phaseProgress;
      }
    }

    return Math.min(100, completedWeight);
  }

  private calculatePhaseProgress(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, (current / total) * 100);
  }

  private getProgressEventType(): ProgressEventType {
    const phaseEventMap: Record<GenerationPhase, ProgressEventType> = {
      initialization: 'generation-started',
      analysis: 'architecture-analyzing',
      generation: 'page-generating',
      finalization: 'storage-saving',
    };
    return phaseEventMap[this.currentPhase];
  }

  private emitProgressEvent(
    type: ProgressEventType,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const event: WikiProgressEvent = {
      type,
      phase: this.currentPhase,
      progress: this.calculateOverallProgress(),
      current: this.currentStep,
      total: this.totalSteps,
      message,
      timestamp: new Date(),
      details,
    };

    this.emit('progress', event);
  }

  private notifyProgressCallbacks(): void {
    const info = this.getProgress();
    for (const callback of this.progressCallbacks) {
      try {
        callback(info);
      } catch (e) {
        console.error('Progress callback error:', e);
      }
    }
  }

  private updatePhaseStats(phase: GenerationPhase, totalItems: number): void {
    const stats = this.phaseStats.find((s) => s.phase === phase);
    if (stats) {
      stats.startTime = new Date();
      stats.totalItems = totalItems;
      stats.itemsProcessed = 0;
    }
  }

  private updateCurrentPhaseStats(itemsProcessed: number): void {
    const stats = this.phaseStats.find((s) => s.phase === this.currentPhase);
    if (stats) {
      stats.itemsProcessed = itemsProcessed;
    }
  }

  private finalizeCurrentPhase(): void {
    const stats = this.phaseStats.find((s) => s.phase === this.currentPhase);
    if (stats && !stats.endTime) {
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
      stats.itemsProcessed = stats.totalItems;
    }
  }
}

export function createProgressMonitor(): IWikiProgressMonitor {
  return new WikiProgressMonitor();
}
