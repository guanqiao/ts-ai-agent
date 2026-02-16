import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  SuggestedAction,
  ActionPriority,
  ISuggestionGenerator,
  ImpactItem,
  RiskLevel,
} from './types';

export class SuggestionGenerator implements ISuggestionGenerator {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async suggestDocUpdates(impacts: ImpactItem[]): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];
    const pageImpacts = impacts.filter((i) => i.targetType === 'page');

    for (const impact of pageImpacts) {
      const priority = this.determineDocPriority(impact);
      const affectedSections = impact.affectedSections;

      suggestions.push({
        id: this.generateActionId(),
        type: 'update-doc',
        priority,
        title: `Update documentation: ${impact.targetName}`,
        description: `The page "${impact.targetName}" may need updates due to changes in ${impact.description}`,
        targetIds: [impact.targetId],
        estimatedEffort: this.estimateDocEffort(affectedSections.length),
        automated: false,
        metadata: {
          reason: impact.description,
          impact: `${affectedSections.length} section(s) potentially affected`,
        },
      });
    }

    const apiImpacts = impacts.filter((i) => i.targetType === 'api');
    for (const impact of apiImpacts) {
      suggestions.push({
        id: this.generateActionId(),
        type: 'update-doc',
        priority: impact.metadata.breakingChange ? 'urgent' : 'high',
        title: `Update API documentation: ${impact.targetName}`,
        description: `API reference for "${impact.targetName}" needs to be updated`,
        targetIds: [impact.targetId],
        estimatedEffort: '30 minutes',
        automated: false,
        metadata: {
          reason: impact.metadata.breakingChange ? 'Breaking change detected' : 'API modification',
          impact: impact.metadata.breakingChange
            ? 'May affect API consumers'
            : 'Documentation sync required',
        },
      });
    }

    return suggestions;
  }

  async suggestTestRuns(impacts: ImpactItem[]): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];
    const affectedFiles = new Set<string>();
    const affectedModules = new Set<string>();

    for (const impact of impacts) {
      if (impact.metadata.symbolName) {
        affectedFiles.add(impact.metadata.symbolName);
      }
      if (impact.targetType === 'module') {
        affectedModules.add(impact.targetName);
      }
    }

    const testCommand = this.detectTestCommand();

    if (affectedFiles.size > 0 || affectedModules.size > 0) {
      suggestions.push({
        id: this.generateActionId(),
        type: 'run-tests',
        priority: this.determineTestPriority(impacts),
        title: 'Run affected tests',
        description: `Run tests for ${affectedFiles.size} file(s) and ${affectedModules.size} module(s)`,
        targetIds: [...affectedFiles, ...affectedModules],
        estimatedEffort: '5-15 minutes',
        automated: true,
        automationCommand: testCommand,
        metadata: {
          reason: 'Changes may affect test coverage',
          impact: `${affectedFiles.size + affectedModules.size} items to test`,
        },
      });
    }

    const breakingChanges = impacts.filter((i) => i.metadata.breakingChange);
    if (breakingChanges.length > 0) {
      suggestions.push({
        id: this.generateActionId(),
        type: 'run-tests',
        priority: 'urgent',
        title: 'Run full test suite',
        description: 'Breaking changes detected - recommend full test suite run',
        targetIds: [],
        estimatedEffort: '15-30 minutes',
        automated: true,
        automationCommand: testCommand || 'npm test',
        metadata: {
          reason: `${breakingChanges.length} breaking change(s) detected`,
          impact: 'Full regression testing recommended',
        },
      });
    }

    return suggestions;
  }

  async suggestNotifications(
    impacts: ImpactItem[],
    riskLevel: RiskLevel
  ): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      suggestions.push({
        id: this.generateActionId(),
        type: 'notify-team',
        priority: riskLevel === 'critical' ? 'urgent' : 'high',
        title: 'Notify development team',
        description: `High-risk changes detected - notify relevant team members`,
        targetIds: [],
        estimatedEffort: '5 minutes',
        automated: false,
        metadata: {
          reason: `Risk level: ${riskLevel}`,
          impact: `${impacts.length} impact(s) identified`,
        },
      });
    }

    const apiImpacts = impacts.filter((i) => i.targetType === 'api');
    if (apiImpacts.length > 0) {
      suggestions.push({
        id: this.generateActionId(),
        type: 'notify-team',
        priority: 'high',
        title: 'Notify API consumers',
        description: 'API changes detected - notify affected consumers',
        targetIds: apiImpacts.map((i) => i.targetId),
        estimatedEffort: '10 minutes',
        automated: false,
        metadata: {
          reason: 'API modification detected',
          impact: `${apiImpacts.length} API endpoint(s) affected`,
        },
      });
    }

    const moduleImpacts = impacts.filter((i) => i.targetType === 'module');
    if (moduleImpacts.length > 0) {
      suggestions.push({
        id: this.generateActionId(),
        type: 'notify-team',
        priority: 'medium',
        title: 'Notify module owners',
        description: 'Module-level changes detected - notify module owners',
        targetIds: moduleImpacts.map((i) => i.targetId),
        estimatedEffort: '5 minutes',
        automated: false,
        metadata: {
          reason: 'Module impact detected',
          impact: `${moduleImpacts.length} module(s) affected`,
        },
      });
    }

    return suggestions;
  }

  async generateAllSuggestions(
    impacts: ImpactItem[],
    riskLevel: RiskLevel
  ): Promise<SuggestedAction[]> {
    const docSuggestions = await this.suggestDocUpdates(impacts);
    const testSuggestions = await this.suggestTestRuns(impacts);
    const notificationSuggestions = await this.suggestNotifications(impacts, riskLevel);

    const allSuggestions = [...docSuggestions, ...testSuggestions, ...notificationSuggestions];

    return this.prioritizeSuggestions(allSuggestions);
  }

  private determineDocPriority(impact: ImpactItem): ActionPriority {
    if (impact.metadata.breakingChange) return 'urgent';
    if (impact.severity === 'high' || impact.severity === 'critical') return 'high';
    if (impact.severity === 'medium') return 'medium';
    return 'low';
  }

  private estimateDocEffort(sectionCount: number): string {
    if (sectionCount === 0) return '15 minutes';
    if (sectionCount <= 2) return '30 minutes';
    if (sectionCount <= 5) return '1 hour';
    return '2+ hours';
  }

  private determineTestPriority(impacts: ImpactItem[]): ActionPriority {
    const hasBreakingChanges = impacts.some((i) => i.metadata.breakingChange);
    const highSeverityCount = impacts.filter(
      (i) => i.severity === 'high' || i.severity === 'critical'
    ).length;

    if (hasBreakingChanges) return 'urgent';
    if (highSeverityCount >= 3) return 'high';
    if (highSeverityCount >= 1) return 'medium';
    return 'low';
  }

  private detectTestCommand(): string | undefined {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const scripts = packageJson.scripts || {};

        if (scripts.test) return 'npm test';
        if (scripts['test:unit']) return 'npm run test:unit';
        if (scripts['test:integration']) return 'npm run test:integration';
      } catch {
        // Ignore parse errors
      }
    }

    return undefined;
  }

  private prioritizeSuggestions(suggestions: SuggestedAction[]): SuggestedAction[] {
    const priorityOrder: Record<ActionPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private generateActionId(): string {
    const hash = crypto
      .createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
    return `sa-${hash}`;
  }
}
