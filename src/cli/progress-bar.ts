import chalk from 'chalk';
import { GenerationPhase, TimeEstimate, ProgressInfo } from '../wiki/types';

interface ProgressBarConfig {
  width: number;
  showTimeEstimate: boolean;
  showPhaseProgress: boolean;
  showSpeed: boolean;
  colorOutput: boolean;
}

const DEFAULT_CONFIG: ProgressBarConfig = {
  width: 50,
  showTimeEstimate: true,
  showPhaseProgress: true,
  showSpeed: true,
  colorOutput: true,
};

const PHASE_CONFIG: Record<
  GenerationPhase,
  { icon: string; label: string; color: (text: string) => string }
> = {
  initialization: { icon: '🚀', label: '初始化', color: chalk.cyan },
  analysis: { icon: '📊', label: '架构分析', color: chalk.blue },
  generation: { icon: '📝', label: '生成页面', color: chalk.green },
  finalization: { icon: '✨', label: '完成处理', color: chalk.magenta },
};

export class EnhancedProgressBar {
  private config: ProgressBarConfig;
  private currentPhase: GenerationPhase = 'initialization';
  private lastProgress: number = 0;
  private lastUpdateTime: number = 0;
  private animationFrame: number = 0;
  private animationChars: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private linesUsed: number = 0;

  constructor(config?: Partial<ProgressBarConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(title: string = 'Wiki 文档生成'): void {
    this.clearScreen();
    this.renderHeader(title);
    this.linesUsed = 3;
  }

  update(info: ProgressInfo): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < 50 && info.progress === this.lastProgress) {
      return;
    }

    this.lastUpdateTime = now;
    this.lastProgress = info.progress;
    this.animationFrame = (this.animationFrame + 1) % this.animationChars.length;

    this.moveCursorToStart();
    this.renderOverallProgress(info);
    this.renderTimeEstimate(info.timeEstimate);

    if (this.config.showPhaseProgress) {
      this.renderPhaseProgress(info);
    }

    this.linesUsed = this.config.showPhaseProgress ? 8 : 5;
  }

  updatePhase(phase: GenerationPhase): void {
    this.currentPhase = phase;
  }

  complete(stats?: { totalPages: number; duration: number }): void {
    this.moveCursorToStart();

    const phaseConfig = PHASE_CONFIG.finalization;
    const bar = '█'.repeat(this.config.width);

    console.log(phaseConfig.color(`${phaseConfig.icon} ${phaseConfig.label}`));
    console.log(chalk.green(`  [${bar}] 100%`));

    if (stats) {
      const durationStr = this.formatDuration(stats.duration);
      console.log(chalk.gray(`  ✓ 生成 ${stats.totalPages} 个页面，耗时 ${durationStr}`));
    } else {
      console.log(chalk.green('  ✓ 完成!'));
    }

    console.log();
  }

  error(message: string): void {
    this.moveCursorToStart();
    console.log(chalk.red(`  ❌ 错误: ${message}`));
    console.log();
  }

  private clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  private moveCursorToStart(): void {
    process.stdout.write(`\x1b[${this.linesUsed}A`);
  }

  private renderHeader(title: string): void {
    const line = '═'.repeat(this.config.width + 20);
    console.log(chalk.cyan(`╔${line}╗`));
    console.log(chalk.cyan(`║  ${title.padEnd(this.config.width + 17)}║`));
    console.log(chalk.cyan(`╠${line}╣`));
  }

  private renderOverallProgress(info: ProgressInfo): void {
    const phaseConfig = PHASE_CONFIG[this.currentPhase];
    const filled = Math.round((info.progress / 100) * this.config.width);
    const empty = this.config.width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const spinner = this.animationChars[this.animationFrame];

    console.log(phaseConfig.color(`${phaseConfig.icon} ${phaseConfig.label}`));
    console.log(chalk.green(`  [${bar}] ${info.percentage.padStart(4)} ${spinner}`));
  }

  private renderTimeEstimate(timeEstimate?: TimeEstimate): void {
    if (!this.config.showTimeEstimate || !timeEstimate) {
      console.log();
      return;
    }

    const elapsed = this.formatDuration(timeEstimate.elapsedMs);
    const remaining = this.formatDuration(timeEstimate.estimatedRemainingMs);
    const total = this.formatDuration(timeEstimate.estimatedTotalMs);
    const speed = timeEstimate.averageSpeed.toFixed(1);

    let timeLine = chalk.gray(
      `  已用: ${elapsed}  预估剩余: ${remaining}  总计: ~${total}`
    );

    if (this.config.showSpeed && timeEstimate.averageSpeed > 0) {
      timeLine += chalk.gray(`  速度: ${speed} 项/秒`);
    }

    console.log(timeLine);
  }

  private renderPhaseProgress(info: ProgressInfo): void {
    const line = '─'.repeat(this.config.width + 20);
    console.log(chalk.gray(`╠${line}╣`));

    const stepInfo = info.total > 0 ? ` (${info.current}/${info.total})` : '';
    const message = info.message.length > 50 ? info.message.substring(0, 47) + '...' : info.message;

    console.log(chalk.gray(`  ${message}${stepInfo}`));
    console.log(chalk.gray(`╚${line}╝`));
  }

  private formatDuration(ms: number): string {
    if (!ms || ms < 0) return '00:00';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}

export function createEnhancedProgressBar(config?: Partial<ProgressBarConfig>): EnhancedProgressBar {
  return new EnhancedProgressBar(config);
}

export function formatTimeEstimate(timeEstimate: TimeEstimate): string {
  const elapsed = formatDuration(timeEstimate.elapsedMs);
  const remaining = formatDuration(timeEstimate.estimatedRemainingMs);
  return `已用 ${elapsed}，预估剩余 ${remaining}`;
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0秒';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}
