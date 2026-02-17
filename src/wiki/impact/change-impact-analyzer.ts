import * as path from 'path';
import { EnhancedChangeImpact, ImpactItem, ImpactChain, RiskAssessment } from './types';
import { RiskAssessmentService } from './risk-assessment';
import { SuggestionGenerator } from './suggestion-generator';

export class ChangeImpactAnalyzer {
  private projectPath: string;
  private riskAssessmentService: RiskAssessmentService;
  private suggestionGenerator: SuggestionGenerator;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.riskAssessmentService = new RiskAssessmentService();
    this.suggestionGenerator = new SuggestionGenerator(projectPath);
  }

  async analyzeFullImpact(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed',
    _changeDescription?: string
  ): Promise<EnhancedChangeImpact> {
    const directImpacts = await this.analyzeDirectImpact(filePath, changeType);
    const indirectImpacts = await this.analyzeIndirectImpact(directImpacts);
    const impactChains = this.traceImpactChain(filePath, directImpacts, indirectImpacts);
    const riskAssessment = this.riskAssessmentService.assessRisk(
      directImpacts,
      indirectImpacts,
      changeType
    );
    const suggestedActions = this.suggestionGenerator.generateSuggestions(
      directImpacts,
      indirectImpacts,
      riskAssessment
    );

    return {
      id: `impact-${Date.now()}`,
      changeType,
      filePath,
      timestamp: new Date(),
      directImpacts,
      indirectImpacts,
      impactChains,
      riskAssessment,
      suggestedActions,
      summary: this.generateSummary(directImpacts, indirectImpacts, riskAssessment),
    };
  }

  async analyzeDirectImpact(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed'
  ): Promise<ImpactItem[]> {
    const impacts: ImpactItem[] = [];
    const relativePath = path.relative(this.projectPath, filePath);

    impacts.push({
      id: `direct-${Date.now()}-1`,
      type: this.getFileType(filePath),
      name: path.basename(filePath),
      path: relativePath,
      impactLevel: this.assessImpactLevel(filePath, changeType),
      description: `${changeType === 'added' ? '新增' : changeType === 'modified' ? '修改' : '删除'}文件`,
      affectedBy: [filePath],
      affects: await this.findAffectedFiles(filePath),
    });

    return impacts;
  }

  async analyzeIndirectImpact(directImpacts: ImpactItem[]): Promise<ImpactItem[]> {
    const indirectImpacts: ImpactItem[] = [];
    const processedPaths = new Set<string>();

    for (const directImpact of directImpacts) {
      for (const affectedPath of directImpact.affects) {
        if (!processedPaths.has(affectedPath)) {
          processedPaths.add(affectedPath);
          indirectImpacts.push({
            id: `indirect-${Date.now()}-${indirectImpacts.length + 1}`,
            type: this.getFileType(affectedPath),
            name: path.basename(affectedPath),
            path: affectedPath,
            impactLevel: 'medium',
            description: `受${directImpact.name}变更影响`,
            affectedBy: [directImpact.path],
            affects: await this.findAffectedFiles(affectedPath),
          });
        }
      }
    }

    return indirectImpacts;
  }

  traceImpactChain(
    rootFilePath: string,
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[]
  ): ImpactChain[] {
    const chains: ImpactChain[] = [];

    for (const directImpact of directImpacts) {
      const chainItems = [directImpact];

      for (const indirectImpact of indirectImpacts) {
        if (indirectImpact.affectedBy.includes(directImpact.path)) {
          chainItems.push(indirectImpact);
        }
      }

      if (chainItems.length > 1) {
        chains.push({
          id: `chain-${Date.now()}-${chains.length + 1}`,
          rootCause: rootFilePath,
          items: chainItems,
          length: chainItems.length,
          severity: this.calculateChainSeverity(chainItems),
          description: `从${directImpact.name}开始的影响链`,
        });
      }
    }

    return chains;
  }

  private getFileType(filePath: string): ImpactItem['type'] {
    const extension = path.extname(filePath).toLowerCase();

    if (['.ts', '.js', '.tsx', '.jsx'].includes(extension)) {
      return 'file';
    } else if (
      ['.test.ts', '.test.js', '.spec.ts', '.spec.js'].some((suffix) => filePath.endsWith(suffix))
    ) {
      return 'test';
    } else if (['.md', '.rst', '.txt'].includes(extension)) {
      return 'document';
    } else {
      return 'file';
    }
  }

  private assessImpactLevel(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed'
  ): ImpactItem['impactLevel'] {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (changeType === 'removed') {
      return 'high';
    }

    if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) {
      return 'high';
    }

    if (['.ts', '.js'].includes(extension)) {
      return 'medium';
    }

    return 'low';
  }

  private async findAffectedFiles(filePath: string): Promise<string[]> {
    const affected: string[] = [];
    const extension = path.extname(filePath).toLowerCase();

    if (['.ts', '.js', '.tsx', '.jsx'].includes(extension)) {
      const testPath = filePath.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1');
      if (testPath !== filePath) {
        affected.push(path.relative(this.projectPath, testPath));
      }

      const docPath = filePath.replace(/\.(ts|js|tsx|jsx)$/, '.md');
      if (docPath !== filePath) {
        affected.push(path.relative(this.projectPath, docPath));
      }
    }

    return affected;
  }

  private calculateChainSeverity(items: ImpactItem[]): ImpactChain['severity'] {
    const highImpactCount = items.filter((item) => item.impactLevel === 'high').length;
    const mediumImpactCount = items.filter((item) => item.impactLevel === 'medium').length;

    if (highImpactCount > 0) {
      return 'high';
    } else if (mediumImpactCount > 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generateSummary(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[],
    riskAssessment: RiskAssessment
  ): string {
    const totalImpacts = directImpacts.length + indirectImpacts.length;
    const highImpactCount = [...directImpacts, ...indirectImpacts].filter(
      (item) => item.impactLevel === 'high'
    ).length;

    return `变更影响分析: 共影响 ${totalImpacts} 个项目，其中高影响 ${highImpactCount} 个。总体风险等级: ${riskAssessment.overallRisk}，风险评分: ${riskAssessment.riskScore}。建议: ${riskAssessment.recommendation}`;
  }
}
