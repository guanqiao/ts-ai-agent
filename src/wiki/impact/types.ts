export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ImpactType = 'direct' | 'indirect' | 'transitive';
export type ActionType =
  | 'update-doc'
  | 'run-tests'
  | 'notify-team'
  | 'review-code'
  | 'update-dependencies'
  | 'check-breaking-changes'
  | 'version-bump';
export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ImpactItem {
  id: string;
  type: ImpactType;
  targetId: string;
  targetType: 'page' | 'module' | 'api' | 'file' | 'symbol';
  targetName: string;
  description: string;
  severity: RiskLevel;
  confidence: number;
  affectedSections: string[];
  metadata: ImpactItemMetadata;
}

export interface ImpactItemMetadata {
  lineNumber?: number;
  symbolName?: string;
  changeType?: 'added' | 'modified' | 'removed';
  breakingChange: boolean;
  deprecation: boolean;
  custom?: Record<string, unknown>;
}

export interface ImpactChain {
  id: string;
  sourceId: string;
  items: ImpactChainItem[];
  totalDepth: number;
  totalRisk: number;
  criticalPath: boolean;
}

export interface ImpactChainItem {
  item: ImpactItem;
  depth: number;
  parentItemId?: string;
  children: string[];
}

export interface EnhancedChangeImpact {
  id: string;
  sourceFile: string;
  changeType: 'added' | 'modified' | 'removed' | 'renamed';
  changeDescription?: string;
  directImpacts: ImpactItem[];
  indirectImpacts: ImpactItem[];
  impactChains: ImpactChain[];
  riskAssessment: RiskAssessment;
  suggestedActions: SuggestedAction[];
  affectedTests: string[];
  affectedDocumentation: string[];
  metadata: EnhancedChangeImpactMetadata;
  createdAt: Date;
}

export interface EnhancedChangeImpactMetadata {
  commitHash?: string;
  author?: string;
  branch?: string;
  analysisTime: number;
  confidence: number;
  custom?: Record<string, unknown>;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskScore: number;
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  confidence: number;
  summary: string;
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  severity: RiskLevel;
  probability: number;
  impact: number;
  category:
    | 'breaking-change'
    | 'dependency'
    | 'testing'
    | 'documentation'
    | 'performance'
    | 'security';
  affectedItems: string[];
  evidence: string[];
}

export interface MitigationStrategy {
  id: string;
  name: string;
  description: string;
  priority: ActionPriority;
  effort: 'low' | 'medium' | 'high';
  riskReduction: number;
  steps: MitigationStep[];
}

export interface MitigationStep {
  order: number;
  action: string;
  details?: string;
  automated: boolean;
}

export interface SuggestedAction {
  id: string;
  type: ActionType;
  priority: ActionPriority;
  title: string;
  description: string;
  targetIds: string[];
  estimatedEffort: string;
  automated: boolean;
  automationCommand?: string;
  metadata: SuggestedActionMetadata;
}

export interface SuggestedActionMetadata {
  reason: string;
  impact: string;
  deadline?: Date;
  assignee?: string;
  custom?: Record<string, unknown>;
}

export interface IChangeImpactAnalyzer {
  analyzeDirectImpact(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed'
  ): Promise<ImpactItem[]>;
  analyzeIndirectImpact(directImpacts: ImpactItem[]): Promise<ImpactItem[]>;
  traceImpactChain(sourceFile: string, maxDepth?: number): Promise<ImpactChain[]>;
}

export interface IRiskAssessmentService {
  calculateRiskScore(impacts: ImpactItem[]): Promise<number>;
  identifyRiskFactors(impacts: ImpactItem[]): Promise<RiskFactor[]>;
  generateMitigation(riskFactors: RiskFactor[]): Promise<MitigationStrategy[]>;
}

export interface ISuggestionGenerator {
  suggestDocUpdates(impacts: ImpactItem[]): Promise<SuggestedAction[]>;
  suggestTestRuns(impacts: ImpactItem[]): Promise<SuggestedAction[]>;
  suggestNotifications(impacts: ImpactItem[], riskLevel: RiskLevel): Promise<SuggestedAction[]>;
}

export interface ImpactAnalysisConfig {
  maxDepth: number;
  includeTests: boolean;
  includeDocumentation: boolean;
  riskThreshold: RiskLevel;
  autoSuggestActions: boolean;
  cacheResults: boolean;
  cacheTTL: number;
}

export interface ImpactAnalysisResult {
  impact: EnhancedChangeImpact;
  processingTime: number;
  cached: boolean;
  warnings: string[];
}
