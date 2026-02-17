import { SuggestedAction, ImpactItem, RiskAssessment, RiskLevel } from './types';

export class SuggestionGenerator {
  constructor(_projectPath: string) {}

  generateSuggestions(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[],
    riskAssessment: RiskAssessment
  ): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    suggestions.push(...this.suggestDocUpdates([...directImpacts, ...indirectImpacts]));
    suggestions.push(
      ...this.suggestTestRuns([...directImpacts, ...indirectImpacts], riskAssessment)
    );
    suggestions.push(
      ...this.suggestNotifications(
        [...directImpacts, ...indirectImpacts],
        riskAssessment.overallRisk
      )
    );

    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  suggestDocUpdates(impacts: ImpactItem[]): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];
    const documentImpacts = impacts.filter((item) => item.type === 'document');
    const codeImpacts = impacts.filter((item) => item.type === 'file');

    if (documentImpacts.length > 0) {
      suggestions.push({
        id: `suggestion-doc-${Date.now()}-1`,
        type: 'update',
        priority: 'medium',
        description: '更新受影响的文档',
        target: documentImpacts.map((item) => item.path).join(', '),
        estimatedEffort: 'low',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
    }

    if (codeImpacts.length > 0) {
      suggestions.push({
        id: `suggestion-doc-${Date.now()}-2`,
        type: 'update',
        priority: 'low',
        description: '检查并更新相关代码文档',
        target: codeImpacts.map((item) => item.path).join(', '),
        estimatedEffort: 'low',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });
    }

    return suggestions;
  }

  suggestTestRuns(impacts: ImpactItem[], riskAssessment: RiskAssessment): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];
    const testImpacts = impacts.filter((item) => item.type === 'test');
    const highImpactImpacts = impacts.filter((item) => item.impactLevel === 'high');

    let priority: SuggestedAction['priority'] = 'medium';
    let estimatedEffort: SuggestedAction['estimatedEffort'] = 'medium';

    if (riskAssessment.overallRisk === 'critical' || riskAssessment.overallRisk === 'high') {
      priority = 'high';
      estimatedEffort = 'high';
    } else if (riskAssessment.overallRisk === 'medium') {
      priority = 'medium';
      estimatedEffort = 'medium';
    } else {
      priority = 'low';
      estimatedEffort = 'low';
    }

    suggestions.push({
      id: `suggestion-test-${Date.now()}-1`,
      type: 'test',
      priority,
      description: '运行相关测试用例',
      target: impacts.map((item) => item.path).join(', '),
      estimatedEffort,
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    });

    if (testImpacts.length > 0) {
      suggestions.push({
        id: `suggestion-test-${Date.now()}-2`,
        type: 'update',
        priority: 'medium',
        description: '更新受影响的测试用例',
        target: testImpacts.map((item) => item.path).join(', '),
        estimatedEffort: 'medium',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      });
    }

    if (highImpactImpacts.length > 0) {
      suggestions.push({
        id: `suggestion-test-${Date.now()}-3`,
        type: 'test',
        priority: 'high',
        description: '进行全面回归测试',
        target: highImpactImpacts.map((item) => item.path).join(', '),
        estimatedEffort: 'high',
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      });
    }

    return suggestions;
  }

  suggestNotifications(impacts: ImpactItem[], riskLevel: RiskLevel): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    let priority: SuggestedAction['priority'] = 'medium';

    if (riskLevel === 'critical' || riskLevel === 'high') {
      priority = 'urgent';
    } else if (riskLevel === 'medium') {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    suggestions.push({
      id: `suggestion-notify-${Date.now()}-1`,
      type: 'notify',
      priority,
      description: '通知团队成员变更影响',
      target: impacts.map((item) => item.path).join(', '),
      estimatedEffort: 'low',
      deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
    });

    if (riskLevel === 'critical' || riskLevel === 'high') {
      suggestions.push({
        id: `suggestion-notify-${Date.now()}-2`,
        type: 'monitor',
        priority: 'high',
        description: '密切监控系统运行状况',
        target: 'production',
        estimatedEffort: 'medium',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
    }

    if (riskLevel === 'critical') {
      suggestions.push({
        id: `suggestion-notify-${Date.now()}-3`,
        type: 'rollback',
        priority: 'urgent',
        description: '准备回滚计划',
        target: impacts.map((item) => item.path).join(', '),
        estimatedEffort: 'medium',
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      });
    }

    return suggestions;
  }

  generateAllSuggestions(impacts: ImpactItem[], riskLevel: RiskLevel): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    const mockRiskAssessment: RiskAssessment = {
      id: `risk-${Date.now()}`,
      overallRisk: riskLevel,
      riskScore: 0,
      factors: [],
      affectedAreas: impacts.map((item) => item.path),
      timeframe: 'immediate',
      recommendation: 'Test recommendation',
    };

    suggestions.push(...this.suggestDocUpdates(impacts));
    suggestions.push(...this.suggestTestRuns(impacts, mockRiskAssessment));
    suggestions.push(...this.suggestNotifications(impacts, riskLevel));

    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}
