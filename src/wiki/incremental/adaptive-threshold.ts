interface ThresholdHistory {
  timestamp: Date;
  projectSize: number;
  changePercentage: number;
  usedIncremental: boolean;
  success: boolean;
  updateTime: number;
}

interface AdaptiveThresholdConfig {
  minThreshold: number;
  maxThreshold: number;
  windowSize: number;
  smallProjectThreshold: number;
  mediumProjectThreshold: number;
  largeProjectThreshold: number;
}

const DEFAULT_CONFIG: AdaptiveThresholdConfig = {
  minThreshold: 20,
  maxThreshold: 80,
  windowSize: 10,
  smallProjectThreshold: 50,
  mediumProjectThreshold: 200,
  largeProjectThreshold: 500,
};

export class AdaptiveThreshold {
  private config: AdaptiveThresholdConfig;
  private history: ThresholdHistory[] = [];

  constructor(config?: Partial<AdaptiveThresholdConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculateThreshold(projectSize: number): number {
    const baseThreshold = this.getBaseThreshold(projectSize);
    const adjustment = this.calculateAdjustment();

    return Math.max(
      this.config.minThreshold,
      Math.min(this.config.maxThreshold, baseThreshold + adjustment)
    );
  }

  shouldUseIncremental(
    projectSize: number,
    changePercentage: number,
    changeTypes?: { added: number; modified: number; deleted: number }
  ): boolean {
    const threshold = this.calculateThreshold(projectSize);

    if (changePercentage > threshold) {
      return false;
    }

    if (changeTypes) {
      const { added, modified, deleted } = changeTypes;
      const total = added + modified + deleted;

      if (total === 0) {
        return false;
      }

      const deleteRatio = deleted / total;
      if (deleteRatio > 0.3) {
        return false;
      }

      const addRatio = added / total;
      if (addRatio > 0.5 && projectSize < this.config.smallProjectThreshold) {
        return false;
      }
    }

    return true;
  }

  recordResult(
    projectSize: number,
    changePercentage: number,
    usedIncremental: boolean,
    success: boolean,
    updateTime: number
  ): void {
    this.history.push({
      timestamp: new Date(),
      projectSize,
      changePercentage,
      usedIncremental,
      success,
      updateTime,
    });

    if (this.history.length > this.config.windowSize) {
      this.history.shift();
    }
  }

  getRecommendation(projectSize: number): {
    threshold: number;
    recommendation: string;
    confidence: number;
  } {
    const threshold = this.calculateThreshold(projectSize);
    const recentSuccess = this.getRecentSuccessRate();
    const avgUpdateTime = this.getAverageUpdateTime();

    let recommendation: string;
    let confidence: number;

    if (this.history.length < 3) {
      recommendation = 'Insufficient history for recommendation. Using default threshold.';
      confidence = 0.5;
    } else if (recentSuccess > 0.9) {
      recommendation = 'Incremental updates working well. Consider lowering threshold for more efficiency.';
      confidence = 0.8;
    } else if (recentSuccess < 0.6) {
      recommendation = 'Incremental updates have issues. Consider raising threshold for more stability.';
      confidence = 0.7;
    } else {
      recommendation = 'Current threshold is appropriate for this project.';
      confidence = 0.6;
    }

    if (avgUpdateTime > 0) {
      recommendation += ` Average update time: ${avgUpdateTime.toFixed(0)}ms.`;
    }

    return { threshold, recommendation, confidence };
  }

  getStats(): {
    historySize: number;
    successRate: number;
    incrementalUsageRate: number;
    averageChangePercentage: number;
    averageUpdateTime: number;
  } {
    const successRate = this.getRecentSuccessRate();
    const incrementalUsageRate = this.history.filter(h => h.usedIncremental).length / Math.max(1, this.history.length);
    const avgChangePercentage = this.history.reduce((sum, h) => sum + h.changePercentage, 0) / Math.max(1, this.history.length);
    const avgUpdateTime = this.getAverageUpdateTime();

    return {
      historySize: this.history.length,
      successRate,
      incrementalUsageRate,
      averageChangePercentage: avgChangePercentage,
      averageUpdateTime: avgUpdateTime,
    };
  }

  private getBaseThreshold(projectSize: number): number {
    if (projectSize < this.config.smallProjectThreshold) {
      return 30;
    } else if (projectSize < this.config.mediumProjectThreshold) {
      return 50;
    } else if (projectSize < this.config.largeProjectThreshold) {
      return 65;
    } else {
      return 75;
    }
  }

  private calculateAdjustment(): number {
    if (this.history.length < 3) {
      return 0;
    }

    const recentSuccess = this.getRecentSuccessRate();
    const incrementalSuccess = this.getIncrementalSuccessRate();

    let adjustment = 0;

    if (recentSuccess > 0.9 && incrementalSuccess > 0.8) {
      adjustment = -5;
    } else if (recentSuccess < 0.7 || incrementalSuccess < 0.6) {
      adjustment = 10;
    } else if (incrementalSuccess < 0.8) {
      adjustment = 5;
    }

    return adjustment;
  }

  private getRecentSuccessRate(): number {
    if (this.history.length === 0) {
      return 1;
    }

    const recent = this.history.slice(-5);
    return recent.filter(h => h.success).length / recent.length;
  }

  private getIncrementalSuccessRate(): number {
    const incrementalUpdates = this.history.filter(h => h.usedIncremental);
    if (incrementalUpdates.length === 0) {
      return 1;
    }

    return incrementalUpdates.filter(h => h.success).length / incrementalUpdates.length;
  }

  private getAverageUpdateTime(): number {
    if (this.history.length === 0) {
      return 0;
    }

    return this.history.reduce((sum, h) => sum + h.updateTime, 0) / this.history.length;
  }
}
