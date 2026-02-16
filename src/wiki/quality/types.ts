export interface QualityScore {
  overall: number;
  dimensions: DimensionScore[];
  grade: QualityGrade;
}

export interface DimensionScore {
  name: QualityDimension;
  score: number;
  maxScore: number;
  weight: number;
  issues: QualityIssue[];
}

export type QualityDimension =
  | 'completeness'
  | 'accuracy'
  | 'readability'
  | 'structure'
  | 'coverage'
  | 'freshness'
  | 'consistency';

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface QualityIssue {
  id: string;
  dimension: QualityDimension;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  message: string;
  location?: QualityIssueLocation;
  suggestion?: string;
}

export interface QualityIssueLocation {
  sectionId?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface QualityReport {
  pageId: string;
  pageTitle: string;
  score: QualityScore;
  issues: QualityIssue[];
  recommendations: QualityRecommendation[];
  generatedAt: Date;
  previousScore?: number;
  trend?: 'improving' | 'stable' | 'declining';
}

export interface QualityRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface IQualityEvaluator {
  evaluate(content: string, metadata?: QualityMetadata): Promise<QualityScore>;
  getScore(pageId: string): Promise<QualityScore | null>;
  getReport(pageId: string): Promise<QualityReport | null>;
  generateReport(pageId: string, content: string, metadata?: QualityMetadata): Promise<QualityReport>;
}

export interface QualityMetadata {
  title?: string;
  lastUpdated?: Date;
  author?: string;
  wordCount?: number;
  sectionCount?: number;
  linkCount?: number;
  codeBlockCount?: number;
}

export interface ICompletenessChecker {
  checkCompleteness(content: string): Promise<CompletenessResult>;
  findMissingSections(content: string): Promise<string[]>;
}

export interface CompletenessResult {
  score: number;
  missingElements: string[];
  presentElements: string[];
  recommendations: string[];
}

export interface IReadabilityScorer {
  scoreReadability(content: string): Promise<ReadabilityResult>;
  analyzeStructure(content: string): Promise<StructureAnalysis>;
}

export interface ReadabilityResult {
  score: number;
  fleschKincaid: number;
  averageSentenceLength: number;
  averageWordLength: number;
  complexWordRatio: number;
  suggestions: string[];
}

export interface StructureAnalysis {
  headingCount: number;
  headingDepth: number;
  paragraphCount: number;
  listCount: number;
  codeBlockCount: number;
  linkCount: number;
  imageCount: number;
  issues: StructureIssue[];
}

export interface StructureIssue {
  type: 'heading-depth' | 'long-paragraph' | 'missing-heading' | 'broken-structure';
  message: string;
  location?: { line: number };
}

export const QUALITY_THRESHOLDS = {
  gradeA: 90,
  gradeB: 80,
  gradeC: 70,
  gradeD: 60,
  gradeF: 0,
};

export const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  completeness: 0.2,
  accuracy: 0.15,
  readability: 0.2,
  structure: 0.15,
  coverage: 0.15,
  freshness: 0.1,
  consistency: 0.05,
};

export const REQUIRED_SECTIONS = [
  'overview',
  'installation',
  'usage',
  'api',
  'examples',
];

export const RECOMMENDED_SECTIONS = [
  'configuration',
  'troubleshooting',
  'contributing',
  'changelog',
  'license',
];
