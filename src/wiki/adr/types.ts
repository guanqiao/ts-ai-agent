export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded' | 'rejected';

export interface Alternative {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  considered: boolean;
  rejectedReason?: string;
}

export interface ADRLink {
  type: 'supersedes' | 'superseded-by' | 'relates-to' | 'amends';
  adrId: string;
  adrTitle?: string;
}

export interface CodeReference {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  symbol?: string;
  snippet?: string;
}

export interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  status: ADRStatus;
  date: Date;
  decisionMakers: string[];
  context: string;
  decision: string;
  consequences: ADRConsequences;
  alternatives: Alternative[];
  links: ADRLink[];
  codeReferences: CodeReference[];
  tags: string[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface ADRConsequences {
  positive: string[];
  negative: string[];
  neutral: string[];
}

export interface ADRFilter {
  status?: ADRStatus[];
  tags?: string[];
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

export interface ADRTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  variables: ADRTemplateVariable[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ADRTemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'date' | 'list' | 'markdown';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface ADRExtractionResult {
  adr: Partial<ArchitectureDecisionRecord>;
  source: 'code' | 'commit' | 'document';
  sourcePath: string;
  confidence: number;
  extractedAt: Date;
}

export interface IADRService {
  create(
    adr: Omit<ArchitectureDecisionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ArchitectureDecisionRecord>;
  update(
    id: string,
    updates: Partial<ArchitectureDecisionRecord>
  ): Promise<ArchitectureDecisionRecord>;
  get(id: string): Promise<ArchitectureDecisionRecord | null>;
  list(filter?: ADRFilter): Promise<ArchitectureDecisionRecord[]>;
  delete(id: string): Promise<boolean>;
  propose(
    title: string,
    context: string,
    decision: string,
    createdBy: string
  ): Promise<ArchitectureDecisionRecord>;
  accept(id: string, acceptedBy: string): Promise<ArchitectureDecisionRecord>;
  deprecate(id: string, reason: string, deprecatedBy: string): Promise<ArchitectureDecisionRecord>;
  supersede(oldId: string, newId: string): Promise<void>;
  reject(id: string, reason: string, rejectedBy: string): Promise<ArchitectureDecisionRecord>;
  linkToPage(adrId: string, pageId: string): Promise<void>;
  linkToCode(adrId: string, reference: CodeReference): Promise<void>;
  getRelated(adrId: string): Promise<ArchitectureDecisionRecord[]>;
}

export interface IADRExtractor {
  extractFromCode(filePath: string, content: string): Promise<ADRExtractionResult[]>;
  extractFromCommits(commitMessages: string[], limit?: number): Promise<ADRExtractionResult[]>;
  extractFromDocs(docPath: string, content: string): Promise<ADRExtractionResult[]>;
}

export interface IADRTemplates {
  getTemplates(): Promise<ADRTemplate[]>;
  getTemplate(id: string): Promise<ADRTemplate | null>;
  addTemplate(template: Omit<ADRTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ADRTemplate>;
  removeTemplate(id: string): Promise<boolean>;
  fillTemplate(templateId: string, variables: Record<string, string>): Promise<string>;
  validateTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ valid: boolean; errors: string[] }>;
}

export const DEFAULT_ADR_TEMPLATE: ADRTemplate = {
  id: 'default',
  name: 'Standard ADR',
  description: 'Standard Architecture Decision Record template',
  content: `# {{title}}

## Status

{{status}}

## Date

{{date}}

## Decision Makers

{{decisionMakers}}

## Context

{{context}}

## Decision

{{decision}}

## Consequences

### Positive

{{positiveConsequences}}

### Negative

{{negativeConsequences}}

### Neutral

{{neutralConsequences}}

## Alternatives Considered

{{alternatives}}

## Tags

{{tags}}
`,
  variables: [
    { name: 'title', description: 'Title of the decision', type: 'text', required: true },
    {
      name: 'status',
      description: 'Current status',
      type: 'list',
      required: true,
      options: ['proposed', 'accepted', 'deprecated', 'superseded', 'rejected'],
    },
    { name: 'date', description: 'Decision date', type: 'date', required: true },
    {
      name: 'decisionMakers',
      description: 'People involved in the decision',
      type: 'text',
      required: true,
    },
    {
      name: 'context',
      description: 'Context and problem statement',
      type: 'markdown',
      required: true,
    },
    { name: 'decision', description: 'The decision made', type: 'markdown', required: true },
    {
      name: 'positiveConsequences',
      description: 'Positive outcomes',
      type: 'markdown',
      required: false,
    },
    {
      name: 'negativeConsequences',
      description: 'Negative outcomes',
      type: 'markdown',
      required: false,
    },
    {
      name: 'neutralConsequences',
      description: 'Neutral outcomes',
      type: 'markdown',
      required: false,
    },
    {
      name: 'alternatives',
      description: 'Alternatives considered',
      type: 'markdown',
      required: false,
    },
    { name: 'tags', description: 'Tags for categorization', type: 'text', required: false },
  ],
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const LIGHTWEIGHT_ADR_TEMPLATE: ADRTemplate = {
  id: 'lightweight',
  name: 'Lightweight ADR',
  description: 'Simplified ADR template for quick decisions',
  content: `# {{title}}

**Status:** {{status}}  
**Date:** {{date}}

## Context

{{context}}

## Decision

{{decision}}

## Consequences

{{consequences}}
`,
  variables: [
    { name: 'title', description: 'Title of the decision', type: 'text', required: true },
    {
      name: 'status',
      description: 'Current status',
      type: 'list',
      required: true,
      options: ['proposed', 'accepted', 'deprecated'],
    },
    { name: 'date', description: 'Decision date', type: 'date', required: true },
    {
      name: 'context',
      description: 'Context and problem statement',
      type: 'markdown',
      required: true,
    },
    { name: 'decision', description: 'The decision made', type: 'markdown', required: true },
    {
      name: 'consequences',
      description: 'Impact of the decision',
      type: 'markdown',
      required: false,
    },
  ],
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const TECH_CHOICE_ADR_TEMPLATE: ADRTemplate = {
  id: 'tech-choice',
  name: 'Technology Choice ADR',
  description: 'ADR template for technology selection decisions',
  content: `# {{title}}

## Status

{{status}}

## Date

{{date}}

## Decision Makers

{{decisionMakers}}

## Context

{{context}}

## Requirements

{{requirements}}

## Options Considered

{{options}}

## Decision

{{decision}}

## Rationale

{{rationale}}

## Consequences

{{consequences}}

## Migration Plan

{{migrationPlan}}
`,
  variables: [
    { name: 'title', description: 'Title of the decision', type: 'text', required: true },
    {
      name: 'status',
      description: 'Current status',
      type: 'list',
      required: true,
      options: ['proposed', 'accepted', 'deprecated', 'superseded'],
    },
    { name: 'date', description: 'Decision date', type: 'date', required: true },
    {
      name: 'decisionMakers',
      description: 'People involved in the decision',
      type: 'text',
      required: true,
    },
    {
      name: 'context',
      description: 'Context and problem statement',
      type: 'markdown',
      required: true,
    },
    {
      name: 'requirements',
      description: 'Requirements for the technology',
      type: 'markdown',
      required: true,
    },
    {
      name: 'options',
      description: 'Options that were considered',
      type: 'markdown',
      required: true,
    },
    { name: 'decision', description: 'The chosen technology', type: 'markdown', required: true },
    {
      name: 'rationale',
      description: 'Why this option was chosen',
      type: 'markdown',
      required: true,
    },
    {
      name: 'consequences',
      description: 'Impact of the decision',
      type: 'markdown',
      required: false,
    },
    {
      name: 'migrationPlan',
      description: 'Plan for migration if applicable',
      type: 'markdown',
      required: false,
    },
  ],
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
