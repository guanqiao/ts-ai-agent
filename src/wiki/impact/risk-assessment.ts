import { RiskAssessment, RiskFactor, RiskLevel, ImpactItem } from './types';

export class RiskAssessmentService {
  assessRisk(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[],
    changeType: 'added' | 'modified' | 'removed'
  ): RiskAssessment {
    const factors = this.identifyRiskFactors(directImpacts, indirectImpacts, changeType);
    const riskScore = this.calculateRiskScore(factors);
    const overallRisk = this.mapScoreToRiskLevel(riskScore);
    const affectedAreas = this.identifyAffectedAreas([...directImpacts, ...indirectImpacts]);
    const timeframe = this.determineTimeframe(changeType, factors);
    const recommendation = this.generateMitigationRecommendation(factors, overallRisk);

    return {
      id: `risk-${Date.now()}`,
      overallRisk,
      riskScore,
      factors,
      affectedAreas,
      timeframe,
      recommendation,
    };
  }

  calculateRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      const severityScore = this.getSeverityScore(factor.severity);
      const weightedScore = severityScore * factor.confidence;
      totalScore += weightedScore;
      totalWeight += factor.confidence;
    }

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
  }

  identifyRiskFactors(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[],
    changeType: 'added' | 'modified' | 'removed'
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const allImpacts = [...directImpacts, ...indirectImpacts];

    if (changeType === 'removed') {
      factors.push({
        id: `factor-${Date.now()}-1`,
        type: 'breaking-change',
        description: '删除文件可能导致其他组件引用失败',
        severity: 'high',
        confidence: 0.9,
        mitigation: '检查所有引用该文件的地方并进行相应修改',
      });
    }

    const highImpactCount = allImpacts.filter(item => item.impactLevel === 'high').length;
    if (highImpactCount > 2) {
      factors.push({
        id: `factor-${Date.now()}-2`,
        type: 'breaking-change',
        description: '多个高影响项目变更',
        severity: 'high',
        confidence: 0.8,
        mitigation: '全面测试所有受影响的功能',
      });
    }

    const testImpacts = allImpacts.filter(item => item.type === 'test');
    if (testImpacts.length > 0) {
      factors.push({
        id: `factor-${Date.now()}-3`,
        type: 'maintenance',
        description: '测试文件受影响',
        severity: 'medium',
        confidence: 0.7,
        mitigation: '更新相关测试用例',
      });
    }

    const documentImpacts = allImpacts.filter(item => item.type === 'document');
    if (documentImpacts.length > 0) {
      factors.push({
        id: `factor-${Date.now()}-4`,
        type: 'maintenance',
        description: '文档受影响',
        severity: 'low',
        confidence: 0.6,
        mitigation: '更新相关文档',
      });
    }

    if (changeType === 'modified' && directImpacts.some(item => item.impactLevel === 'high')) {
      factors.push({
        id: `factor-${Date.now()}-5`,
        type: 'breaking-change',
        description: '修改核心文件',
        severity: 'medium',
        confidence: 0.75,
        mitigation: '进行回归测试',
      });
    }

    return factors;
  }

  generateMitigation(factors: RiskFactor[]): string[] {
    return factors.map(factor => factor.mitigation);
  }

  assessOverallRisk(impacts: ImpactItem[]): RiskLevel {
    const factors = this.identifyRiskFactors(impacts, [], 'modified');
    const score = this.calculateRiskScore(factors);
    return this.mapScoreToRiskLevel(score);
  }

  private getSeverityScore(severity: RiskFactor['severity']): number {
    switch (severity) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private mapScoreToRiskLevel(score: number): RiskLevel {
    if (score >= 2.5) {
      return 'critical';
    } else if (score >= 1.8) {
      return 'high';
    } else if (score >= 1.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private identifyAffectedAreas(impacts: ImpactItem[]): string[] {
    const areas = new Set<string>();

    for (const impact of impacts) {
      const area = this.extractAreaFromPath(impact.path);
      if (area) {
        areas.add(area);
      }
      areas.add(impact.type);
    }

    return Array.from(areas);
  }

  private determineTimeframe(
    changeType: 'added' | 'modified' | 'removed',
    factors: RiskFactor[]
  ): 'immediate' | 'short-term' | 'long-term' {
    if (changeType === 'removed' || factors.some(f => f.severity === 'high')) {
      return 'immediate';
    } else if (factors.some(f => f.severity === 'medium')) {
      return 'short-term';
    } else {
      return 'long-term';
    }
  }

  private generateMitigationRecommendation(_factors: RiskFactor[], overallRisk: RiskLevel): string {
    if (overallRisk === 'critical') {
      return '立即进行全面测试，考虑实施回滚计划，通知所有相关团队成员';
    } else if (overallRisk === 'high') {
      return '进行详细测试，更新相关文档，通知受影响的团队';
    } else if (overallRisk === 'medium') {
      return '进行常规测试，更新相关文档';
    } else {
      return '进行基本测试，监控系统运行状况';
    }
  }

  private extractAreaFromPath(filePath: string): string | null {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      return parts[0];
    }
    return null;
  }
}
