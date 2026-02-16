export interface ImpactItem {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'module' | 'test' | 'document';
  name: string;
  path: string;
  impactLevel: 'low' | 'medium' | 'high';
  description: string;
  affectedBy: string[];
  affects: string[];
  metadata?: Record<string, unknown>;
}

export interface ImpactChain {
  id: string;
  rootCause: string;
  items: ImpactItem[];
  length: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface EnhancedChangeImpact {
  id: string;
  changeType: 'added' | 'modified' | 'removed';
  filePath: string;
  timestamp: Date;
  directImpacts: ImpactItem[];
  indirectImpacts: ImpactItem[];
  impactChains: ImpactChain[];
  riskAssessment: RiskAssessment;
  suggestedActions: SuggestedAction[];
  summary: string;
}

export interface RiskFactor {
  id: string;
  type: 'breaking-change' | 'performance' | 'security' | 'compatibility' | 'maintenance';
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  mitigation: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  id: string;
  overallRisk: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  affectedAreas: string[];
  timeframe: 'immediate' | 'short-term' | 'long-term';
  recommendation: string;
}

export type ActionType = 'test' | 'review' | 'update' | 'notify' | 'monitor' | 'rollback';

export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SuggestedAction {
  id: string;
  type: ActionType;
  priority: ActionPriority;
  description: string;
  target: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  deadline?: Date;
  responsible?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}
