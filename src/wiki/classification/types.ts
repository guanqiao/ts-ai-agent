import { WikiPage } from '../types';

export enum ContentCategory {
  Overview = 'overview',
  Architecture = 'architecture',
  API = 'api',
  Module = 'module',
  Guide = 'guide',
  Tutorial = 'tutorial',
  Reference = 'reference',
  Example = 'example',
  Test = 'test',
  Config = 'config',
  Changelog = 'changelog',
  Decision = 'decision',
  Pattern = 'pattern',
  BestPractice = 'best-practice',
  Troubleshooting = 'troubleshooting',
  Unknown = 'unknown',
}

export interface ClassificationResult {
  category: ContentCategory;
  confidence: number;
  subCategories: ContentCategory[];
  suggestedTags: string[];
  reasoning: string;
}

export interface CategoryRule {
  id: string;
  name: string;
  category: ContentCategory;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | string[] | number | RegExp;
  weight: number;
}

export type ConditionField =
  | 'title'
  | 'content'
  | 'tags'
  | 'sourceFiles'
  | 'symbols'
  | 'sections'
  | 'links';

export type ConditionOperator =
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'startsWith'
  | 'endsWith'
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'in'
  | 'notIn'
  | 'exists';

export interface RuleAction {
  type: 'assign' | 'suggest' | 'tag';
  category?: ContentCategory;
  tags?: string[];
  confidence: number;
}

export interface IContentClassifier {
  classify(content: string, metadata?: ClassificationMetadata): Promise<ClassificationResult>;
  autoCategorize(page: WikiPage): Promise<ClassificationResult>;
  suggestCategory(content: string): Promise<ContentCategory[]>;
}

export interface ClassificationMetadata {
  title?: string;
  tags?: string[];
  sourceFiles?: string[];
  symbols?: string[];
  sections?: string[];
}

export interface IRuleEngine {
  applyRules(content: string, metadata: ClassificationMetadata): Promise<RuleMatchResult[]>;
  addRule(rule: CategoryRule): void;
  removeRule(ruleId: string): boolean;
  getRules(): CategoryRule[];
  enableRule(ruleId: string): void;
  disableRule(ruleId: string): void;
}

export interface RuleMatchResult {
  rule: CategoryRule;
  matchedConditions: RuleCondition[];
  score: number;
  actions: RuleAction[];
}

export interface IClassifier {
  classify(content: string): Promise<ClassificationResult>;
  train?(samples: TrainingSample[]): Promise<void>;
}

export interface TrainingSample {
  content: string;
  category: ContentCategory;
  metadata?: ClassificationMetadata;
}

export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  {
    id: 'overview-title',
    name: 'Overview by Title',
    category: ContentCategory.Overview,
    priority: 100,
    conditions: [
      { field: 'title', operator: 'matches', value: /^(overview|summary|introduction|readme)$/i, weight: 1.0 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Overview, confidence: 0.95 }],
    enabled: true,
  },
  {
    id: 'architecture-title',
    name: 'Architecture by Title',
    category: ContentCategory.Architecture,
    priority: 90,
    conditions: [
      { field: 'title', operator: 'matches', value: /architecture|design|structure|system/i, weight: 0.9 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Architecture, confidence: 0.9 }],
    enabled: true,
  },
  {
    id: 'api-content',
    name: 'API by Content',
    category: ContentCategory.API,
    priority: 80,
    conditions: [
      { field: 'content', operator: 'contains', value: ['API', 'endpoint', 'request', 'response', 'REST'], weight: 0.3 },
      { field: 'content', operator: 'matches', value: /```(typescript|javascript|json)/, weight: 0.4 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.API, confidence: 0.85 }],
    enabled: true,
  },
  {
    id: 'module-title',
    name: 'Module by Title',
    category: ContentCategory.Module,
    priority: 85,
    conditions: [
      { field: 'title', operator: 'matches', value: /^module:?\s/i, weight: 1.0 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Module, confidence: 0.95 }],
    enabled: true,
  },
  {
    id: 'guide-content',
    name: 'Guide by Content',
    category: ContentCategory.Guide,
    priority: 70,
    conditions: [
      { field: 'content', operator: 'contains', value: ['getting started', 'how to', 'tutorial', 'guide', 'step'], weight: 0.5 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Guide, confidence: 0.8 }],
    enabled: true,
  },
  {
    id: 'example-content',
    name: 'Example by Content',
    category: ContentCategory.Example,
    priority: 60,
    conditions: [
      { field: 'title', operator: 'matches', value: /example|demo|sample/i, weight: 0.7 },
      { field: 'content', operator: 'matches', value: /```[\s\S]*```/, weight: 0.5 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Example, confidence: 0.85 }],
    enabled: true,
  },
  {
    id: 'config-content',
    name: 'Config by Content',
    category: ContentCategory.Config,
    priority: 75,
    conditions: [
      { field: 'title', operator: 'matches', value: /config|settings?|options?/i, weight: 0.8 },
      { field: 'sourceFiles', operator: 'contains', value: ['config', '.env', 'settings'], weight: 0.6 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Config, confidence: 0.85 }],
    enabled: true,
  },
  {
    id: 'test-content',
    name: 'Test by Content',
    category: ContentCategory.Test,
    priority: 65,
    conditions: [
      { field: 'sourceFiles', operator: 'matches', value: /\.(test|spec)\./, weight: 0.9 },
      { field: 'content', operator: 'contains', value: ['describe(', 'it(', 'expect(', 'test('], weight: 0.7 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Test, confidence: 0.9 }],
    enabled: true,
  },
  {
    id: 'changelog-title',
    name: 'Changelog by Title',
    category: ContentCategory.Changelog,
    priority: 95,
    conditions: [
      { field: 'title', operator: 'matches', value: /^changelog|changes|release\snotes?$/i, weight: 1.0 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Changelog, confidence: 0.95 }],
    enabled: true,
  },
  {
    id: 'decision-content',
    name: 'Decision by Content',
    category: ContentCategory.Decision,
    priority: 70,
    conditions: [
      { field: 'title', operator: 'matches', value: /^ADR|decision|why\s/i, weight: 0.9 },
      { field: 'content', operator: 'contains', value: ['decision', 'chosen', 'alternative', 'consequence'], weight: 0.5 },
    ],
    actions: [{ type: 'assign', category: ContentCategory.Decision, confidence: 0.85 }],
    enabled: true,
  },
];
