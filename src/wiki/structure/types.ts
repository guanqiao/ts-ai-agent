import { ParsedFile, SymbolKind } from '../../types';

export enum SectionType {
  Overview = 'overview',
  Architecture = 'architecture',
  Module = 'module',
  API = 'api',
  Guide = 'guide',
  Reference = 'reference',
  Changelog = 'changelog',
  Contributing = 'contributing',
  Decision = 'decision',
  Example = 'example',
  Test = 'test',
  Config = 'config',
  Custom = 'custom',
}

export enum SectionPriority {
  Critical = 1,
  High = 2,
  Medium = 3,
  Low = 4,
  Optional = 5,
}

export interface DocumentSection {
  id: string;
  title: string;
  type: SectionType;
  priority: SectionPriority;
  level: number;
  content?: string;
  children: DocumentSection[];
  metadata: SectionMetadata;
  sourceFiles: string[];
  symbols: string[];
}

export interface SectionMetadata {
  tags: string[];
  category: string;
  wordCount?: number;
  estimatedReadTime?: number;
  lastUpdated?: Date;
  author?: string;
}

export interface SectionHierarchy {
  root: DocumentSection;
  flatSections: DocumentSection[];
  maxDepth: number;
  totalSections: number;
}

export interface SectionTemplate {
  id: string;
  name: string;
  type: SectionType;
  priority: SectionPriority;
  titleTemplate: string;
  contentTemplate?: string;
  requiredVariables: string[];
  optionalVariables: string[];
  children?: SectionTemplate[];
}

export interface StructureAnalysisResult {
  suggestedSections: DocumentSection[];
  existingSections: DocumentSection[];
  missingSections: DocumentSection[];
  redundantSections: DocumentSection[];
  recommendations: StructureRecommendation[];
}

export interface StructureRecommendation {
  type: 'add' | 'remove' | 'reorder' | 'merge' | 'split';
  sectionId?: string;
  targetSectionId?: string;
  reason: string;
  priority: SectionPriority;
}

export interface IStructureGenerator {
  generateStructure(
    parsedFiles: ParsedFile[],
    architecture: ArchitectureContext
  ): Promise<SectionHierarchy>;
  analyzeContent(
    sections: DocumentSection[],
    parsedFiles: ParsedFile[]
  ): Promise<StructureAnalysisResult>;
  suggestSections(
    parsedFiles: ParsedFile[],
    existingSections: DocumentSection[]
  ): Promise<DocumentSection[]>;
}

export interface ArchitectureContext {
  pattern: string;
  layers: ArchitectureLayer[];
  modules: ArchitectureModule[];
  metrics: ArchitectureMetrics;
}

export interface ArchitectureLayer {
  name: string;
  description?: string;
  modules: string[];
}

export interface ArchitectureModule {
  name: string;
  path: string;
  symbols: SymbolInfo[];
  dependencies: string[];
}

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  description?: string;
  exported: boolean;
}

export interface ArchitectureMetrics {
  totalFiles: number;
  totalSymbols: number;
  averageCohesion: number;
  averageCoupling: number;
  circularDependencies: number;
}

export interface ContentOrganizationOptions {
  maxSectionDepth: number;
  minSectionLength: number;
  maxSectionLength: number;
  mergeThreshold: number;
  splitThreshold: number;
}

export const DEFAULT_ORGANIZATION_OPTIONS: ContentOrganizationOptions = {
  maxSectionDepth: 4,
  minSectionLength: 100,
  maxSectionLength: 5000,
  mergeThreshold: 200,
  splitThreshold: 3000,
};

export const BUILTIN_SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'overview',
    name: 'Overview',
    type: SectionType.Overview,
    priority: SectionPriority.Critical,
    titleTemplate: 'Overview',
    requiredVariables: ['projectName'],
    optionalVariables: ['description', 'version'],
  },
  {
    id: 'architecture',
    name: 'Architecture',
    type: SectionType.Architecture,
    priority: SectionPriority.High,
    titleTemplate: 'Architecture',
    requiredVariables: [],
    optionalVariables: ['pattern', 'layers'],
    children: [
      {
        id: 'architecture-pattern',
        name: 'Architecture Pattern',
        type: SectionType.Architecture,
        priority: SectionPriority.High,
        titleTemplate: 'Architecture Pattern',
        requiredVariables: [],
        optionalVariables: ['pattern'],
      },
      {
        id: 'architecture-layers',
        name: 'Layers',
        type: SectionType.Architecture,
        priority: SectionPriority.High,
        titleTemplate: 'Layers',
        requiredVariables: [],
        optionalVariables: ['layers'],
      },
    ],
  },
  {
    id: 'modules',
    name: 'Modules',
    type: SectionType.Module,
    priority: SectionPriority.High,
    titleTemplate: 'Modules',
    requiredVariables: [],
    optionalVariables: ['modules'],
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    type: SectionType.API,
    priority: SectionPriority.High,
    titleTemplate: 'API Reference',
    requiredVariables: [],
    optionalVariables: ['apis'],
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    type: SectionType.Guide,
    priority: SectionPriority.High,
    titleTemplate: 'Getting Started',
    requiredVariables: [],
    optionalVariables: ['prerequisites', 'installation', 'usage'],
  },
  {
    id: 'examples',
    name: 'Examples',
    type: SectionType.Example,
    priority: SectionPriority.Medium,
    titleTemplate: 'Examples',
    requiredVariables: [],
    optionalVariables: ['examples'],
  },
  {
    id: 'changelog',
    name: 'Changelog',
    type: SectionType.Changelog,
    priority: SectionPriority.Low,
    titleTemplate: 'Changelog',
    requiredVariables: [],
    optionalVariables: ['changes'],
  },
  {
    id: 'contributing',
    name: 'Contributing',
    type: SectionType.Contributing,
    priority: SectionPriority.Low,
    titleTemplate: 'Contributing',
    requiredVariables: [],
    optionalVariables: ['guidelines'],
  },
];
