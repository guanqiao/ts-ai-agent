export type SummaryType =
  | 'brief'
  | 'detailed'
  | 'technical'
  | 'user-friendly'
  | 'api'
  | 'architecture';

export type SummaryLength = 'short' | 'medium' | 'long';

export type SummaryStyle = 'formal' | 'casual' | 'technical';

export interface SummaryConfig {
  type: SummaryType;
  length: SummaryLength;
  style: SummaryStyle;
  maxLength?: number;
  includeKeyPoints: boolean;
  includeExamples: boolean;
  targetAudience?: string;
}

export const DEFAULT_SUMMARY_CONFIG: SummaryConfig = {
  type: 'brief',
  length: 'medium',
  style: 'formal',
  includeKeyPoints: true,
  includeExamples: false,
};

export interface GeneratedSummary {
  text: string;
  keyPoints: string[];
  wordCount: number;
  readingTime: number;
  type: SummaryType;
  confidence: number;
}

export interface SummaryTemplate {
  id: string;
  name: string;
  type: SummaryType;
  template: string;
  variables: string[];
  examples: string[];
}

export interface KeyPoint {
  text: string;
  importance: number;
  category: 'main' | 'secondary' | 'detail';
}

export interface ISummaryGenerator {
  generateSummary(content: string, config?: Partial<SummaryConfig>): Promise<GeneratedSummary>;
  extractKeyPoints(content: string, maxPoints?: number): Promise<KeyPoint[]>;
  formatSummary(summary: string, style: SummaryStyle): string;
}

export interface IAIEnhancer {
  enhanceWithAI(content: string, context?: string): Promise<string>;
  improveClarity(text: string): Promise<string>;
  generateContextualSummary(content: string, context: string): Promise<string>;
}

export const SUMMARY_TEMPLATES: SummaryTemplate[] = [
  {
    id: 'brief-overview',
    name: 'Brief Overview',
    type: 'brief',
    template: '{{title}} is {{description}}. Key features include: {{keyPoints}}.',
    variables: ['title', 'description', 'keyPoints'],
    examples: [
      'UserService is a service for managing users. Key features include: authentication, profile management.',
    ],
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    type: 'api',
    template:
      '## {{name}}\n\n{{description}}\n\n### Methods\n{{methods}}\n\n### Parameters\n{{parameters}}',
    variables: ['name', 'description', 'methods', 'parameters'],
    examples: [
      '## UserService\n\nManages user operations.\n\n### Methods\n- getUser(id)\n- createUser(data)',
    ],
  },
  {
    id: 'architecture',
    name: 'Architecture Summary',
    type: 'architecture',
    template: 'The {{system}} follows {{pattern}} pattern. It consists of {{components}}.',
    variables: ['system', 'pattern', 'components'],
    examples: [
      'The UserService follows service pattern. It consists of: controller, repository, validator.',
    ],
  },
];

export const LENGTH_LIMITS: Record<SummaryLength, { words: number; sentences: number }> = {
  short: { words: 50, sentences: 2 },
  medium: { words: 150, sentences: 5 },
  long: { words: 300, sentences: 10 },
};
