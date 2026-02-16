import {
  RiskAssessment,
  RiskFactor,
  RiskLevel,
  MitigationStrategy,
  IRiskAssessmentService,
  ImpactItem,
} from './types';

export class RiskAssessmentService implements IRiskAssessmentService {
  constructor() {}

  async calculateRiskScore(impacts: ImpactItem[]): Promise<number> {
    if (impacts.length === 0) return 0;

    let totalScore = 0;
    const severityWeights = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const impact of impacts) {
      const severityWeight = severityWeights[impact.severity];
      const typeMultiplier = impact.type === 'direct' ? 1.5 : 1.0;
      const confidenceFactor = impact.confidence;

      const impactScore = severityWeight * typeMultiplier * confidenceFactor * 10;
      totalScore += impactScore;

      if (impact.metadata.breakingChange) {
        totalScore += 20;
      }
    }

    const normalizedScore = Math.min(100, totalScore / Math.sqrt(impacts.length));

    return Math.round(normalizedScore);
  }

  async identifyRiskFactors(impacts: ImpactItem[]): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    const breakingChanges = impacts.filter((i) => i.metadata.breakingChange);
    if (breakingChanges.length > 0) {
      riskFactors.push(
        this.createRiskFactor(
          'breaking-changes',
          'Breaking Changes Detected',
          `${breakingChanges.length} breaking change(s) detected that may require updates in dependent code`,
          'breaking-change',
          breakingChanges.length >= 3
            ? 'critical'
            : breakingChanges.length >= 2
              ? 'high'
              : 'medium',
          0.9,
          breakingChanges.map((i) => i.targetName)
        )
      );
    }

    const highSeverityImpacts = impacts.filter(
      (i) => i.severity === 'high' || i.severity === 'critical'
    );
    if (highSeverityImpacts.length > 0) {
      riskFactors.push(
        this.createRiskFactor(
          'high-severity-impacts',
          'High Severity Impacts',
          `${highSeverityImpacts.length} high severity impact(s) identified`,
          'dependency',
          highSeverityImpacts.length >= 5
            ? 'critical'
            : highSeverityImpacts.length >= 3
              ? 'high'
              : 'medium',
          0.85,
          highSeverityImpacts.map((i) => i.targetName)
        )
      );
    }

    const apiImpacts = impacts.filter((i) => i.targetType === 'api');
    if (apiImpacts.length > 0) {
      riskFactors.push(
        this.createRiskFactor(
          'api-changes',
          'API Changes',
          `${apiImpacts.length} API-related impact(s) detected`,
          'dependency',
          apiImpacts.length >= 3 ? 'high' : 'medium',
          0.8,
          apiImpacts.map((i) => i.targetName)
        )
      );
    }

    const docImpacts = impacts.filter(
      (i) => i.targetType === 'page' && i.affectedSections.length > 0
    );
    if (docImpacts.length > 0) {
      riskFactors.push(
        this.createRiskFactor(
          'documentation-drift',
          'Documentation Drift',
          `${docImpacts.length} documentation page(s) may become outdated`,
          'documentation',
          'medium',
          0.7,
          docImpacts.map((i) => i.targetName)
        )
      );
    }

    const moduleImpacts = impacts.filter((i) => i.targetType === 'module');
    if (moduleImpacts.length > 0) {
      riskFactors.push(
        this.createRiskFactor(
          'module-impact',
          'Module-Level Impact',
          `${moduleImpacts.length} module(s) affected by changes`,
          'dependency',
          moduleImpacts.length >= 3 ? 'high' : 'medium',
          0.75,
          moduleImpacts.map((i) => i.targetName)
        )
      );
    }

    const lowConfidenceImpacts = impacts.filter((i) => i.confidence < 0.6);
    if (lowConfidenceImpacts.length > impacts.length * 0.3) {
      riskFactors.push(
        this.createRiskFactor(
          'analysis-uncertainty',
          'Analysis Uncertainty',
          'Impact analysis has lower confidence due to limited information',
          'testing',
          'low',
          0.5,
          []
        )
      );
    }

    return riskFactors;
  }

  async generateMitigation(riskFactors: RiskFactor[]): Promise<MitigationStrategy[]> {
    const strategies: MitigationStrategy[] = [];

    for (const factor of riskFactors) {
      const strategy = this.createMitigationForFactor(factor);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    if (riskFactors.some((f) => f.severity === 'critical' || f.severity === 'high')) {
      strategies.push(this.createGeneralMitigation(riskFactors));
    }

    return strategies;
  }

  async assessOverallRisk(impacts: ImpactItem[]): Promise<RiskAssessment> {
    const riskScore = await this.calculateRiskScore(impacts);
    const riskFactors = await this.identifyRiskFactors(impacts);
    const mitigationStrategies = await this.generateMitigation(riskFactors);

    const overallRisk = this.determineOverallRiskLevel(riskScore, riskFactors);
    const confidence = this.calculateOverallConfidence(impacts, riskFactors);
    const summary = this.generateSummary(overallRisk, riskScore, riskFactors);

    return {
      overallRisk,
      riskScore,
      riskFactors,
      mitigationStrategies,
      confidence,
      summary,
    };
  }

  private createRiskFactor(
    id: string,
    name: string,
    description: string,
    category: RiskFactor['category'],
    severity: RiskLevel,
    probability: number,
    affectedItems: string[]
  ): RiskFactor {
    return {
      id: `rf-${id}`,
      name,
      description,
      severity,
      probability,
      impact: this.calculateImpact(severity),
      category,
      affectedItems,
      evidence: affectedItems.slice(0, 5).map((item) => `Affects: ${item}`),
    };
  }

  private calculateImpact(severity: RiskLevel): number {
    const impactMap: Record<RiskLevel, number> = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25,
    };
    return impactMap[severity];
  }

  private createMitigationForFactor(factor: RiskFactor): MitigationStrategy | null {
    const mitigations: Record<string, () => MitigationStrategy> = {
      'breaking-changes': () => ({
        id: `ms-${factor.id}`,
        name: 'Breaking Change Migration',
        description: 'Plan and execute migration for breaking changes',
        priority: 'urgent',
        effort: 'high',
        riskReduction: 0.6,
        steps: [
          { order: 1, action: 'Identify all affected components', automated: false },
          { order: 2, action: 'Create migration guide', automated: false },
          { order: 3, action: 'Update dependent code', automated: false },
          { order: 4, action: 'Run integration tests', automated: true },
        ],
      }),
      'high-severity-impacts': () => ({
        id: `ms-${factor.id}`,
        name: 'High Severity Impact Review',
        description: 'Review and address high severity impacts',
        priority: 'high',
        effort: 'medium',
        riskReduction: 0.5,
        steps: [
          { order: 1, action: 'Review each high severity impact', automated: false },
          { order: 2, action: 'Prioritize remediation efforts', automated: false },
          { order: 3, action: 'Implement fixes', automated: false },
          { order: 4, action: 'Verify fixes with tests', automated: true },
        ],
      }),
      'api-changes': () => ({
        id: `ms-${factor.id}`,
        name: 'API Change Documentation',
        description: 'Document and communicate API changes',
        priority: 'high',
        effort: 'medium',
        riskReduction: 0.4,
        steps: [
          { order: 1, action: 'Update API documentation', automated: false },
          { order: 2, action: 'Generate changelog entry', automated: true },
          { order: 3, action: 'Notify API consumers', automated: true },
        ],
      }),
      'documentation-drift': () => ({
        id: `ms-${factor.id}`,
        name: 'Documentation Update',
        description: 'Update affected documentation pages',
        priority: 'medium',
        effort: 'low',
        riskReduction: 0.3,
        steps: [
          { order: 1, action: 'Review outdated sections', automated: false },
          { order: 2, action: 'Update content', automated: false },
          { order: 3, action: 'Verify accuracy', automated: false },
        ],
      }),
      'module-impact': () => ({
        id: `ms-${factor.id}`,
        name: 'Module Impact Assessment',
        description: 'Assess and address module-level impacts',
        priority: 'medium',
        effort: 'medium',
        riskReduction: 0.35,
        steps: [
          { order: 1, action: 'Analyze module dependencies', automated: true },
          { order: 2, action: 'Update affected modules', automated: false },
          { order: 3, action: 'Run module tests', automated: true },
        ],
      }),
      'analysis-uncertainty': () => ({
        id: `ms-${factor.id}`,
        name: 'Enhanced Analysis',
        description: 'Perform additional analysis to improve confidence',
        priority: 'low',
        effort: 'low',
        riskReduction: 0.2,
        steps: [
          { order: 1, action: 'Review code changes manually', automated: false },
          { order: 2, action: 'Consult with team members', automated: false },
          { order: 3, action: 'Run additional checks', automated: true },
        ],
      }),
    };

    const creator = mitigations[factor.id.replace('rf-', '')];
    return creator ? creator() : null;
  }

  private createGeneralMitigation(riskFactors: RiskFactor[]): MitigationStrategy {
    const highPriorityCount = riskFactors.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    ).length;

    return {
      id: 'ms-general',
      name: 'Comprehensive Risk Review',
      description: 'Conduct comprehensive review of all identified risks',
      priority: highPriorityCount > 2 ? 'urgent' : 'high',
      effort: 'high',
      riskReduction: 0.5,
      steps: [
        { order: 1, action: 'Review all risk factors', automated: false },
        { order: 2, action: 'Create action plan', automated: false },
        { order: 3, action: 'Assign responsibilities', automated: false },
        { order: 4, action: 'Set up monitoring', automated: true },
        { order: 5, action: 'Schedule follow-up review', automated: true },
      ],
    };
  }

  private determineOverallRiskLevel(riskScore: number, riskFactors: RiskFactor[]): RiskLevel {
    if (riskFactors.some((f) => f.severity === 'critical')) return 'critical';
    if (riskScore >= 70 || riskFactors.filter((f) => f.severity === 'high').length >= 2)
      return 'high';
    if (riskScore >= 40 || riskFactors.some((f) => f.severity === 'high')) return 'medium';
    return 'low';
  }

  private calculateOverallConfidence(impacts: ImpactItem[], riskFactors: RiskFactor[]): number {
    if (impacts.length === 0) return 0.5;

    const avgImpactConfidence = impacts.reduce((sum, i) => sum + i.confidence, 0) / impacts.length;
    const avgFactorProbability =
      riskFactors.length > 0
        ? riskFactors.reduce((sum, f) => sum + f.probability, 0) / riskFactors.length
        : 0.5;

    return avgImpactConfidence * 0.6 + avgFactorProbability * 0.4;
  }

  private generateSummary(
    overallRisk: RiskLevel,
    riskScore: number,
    riskFactors: RiskFactor[]
  ): string {
    const riskLevelText = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    }[overallRisk];

    const factorSummary =
      riskFactors.length > 0
        ? `Identified ${riskFactors.length} risk factor(s): ${riskFactors.map((f) => f.name).join(', ')}.`
        : 'No significant risk factors identified.';

    return `Overall risk level: ${riskLevelText} (Score: ${riskScore}/100). ${factorSummary}`;
  }
}
