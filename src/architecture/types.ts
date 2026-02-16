import { ParsedFile, CodeSymbol } from '../types';

export type ArchitecturePattern =
  | 'mvc'
  | 'mvvm'
  | 'microservices'
  | 'monolith'
  | 'layered'
  | 'event-driven'
  | 'hexagonal'
  | 'modular'
  | 'plugin'
  | 'unknown';

export interface PatternMatch {
  pattern: ArchitecturePattern;
  confidence: number;
  indicators: string[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'module' | 'class' | 'function' | 'package';
  filePath: string;
  metadata?: Record<string, unknown>;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'import' | 'extends' | 'implements' | 'calls' | 'uses';
  weight: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  adjacencyList: Map<string, Set<string>>;
  reverseAdjacencyList: Map<string, Set<string>>;
}

export interface ModuleInfo {
  name: string;
  path: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  dependents: string[];
  cohesion: number;
  coupling: number;
}

export interface LayerInfo {
  name: string;
  modules: ModuleInfo[];
  dependencies: string[];
  description?: string;
}

export interface BusinessFlow {
  id: string;
  name: string;
  description?: string;
  steps: FlowStep[];
  entryPoints: string[];
  exitPoints: string[];
}

export interface FlowStep {
  id: string;
  name: string;
  type: 'function' | 'class' | 'module';
  filePath: string;
  nextSteps: string[];
}

export interface TechnicalDecision {
  id: string;
  title: string;
  description: string;
  rationale?: string;
  consequences?: string[];
  alternatives?: string[];
  relatedFiles: string[];
  detectedAt: Date;
}

export interface ArchitectureReport {
  pattern: PatternMatch;
  modules: ModuleInfo[];
  layers: LayerInfo[];
  dependencyGraph: DependencyGraph;
  businessFlows: BusinessFlow[];
  technicalDecisions: TechnicalDecision[];
  metrics: ArchitectureMetrics;
  recommendations: string[];
  generatedAt: Date;
}

export interface ArchitectureMetrics {
  totalModules: number;
  totalClasses: number;
  totalFunctions: number;
  totalInterfaces: number;
  averageCohesion: number;
  averageCoupling: number;
  circularDependencies: number;
  maxDependencyDepth: number;
  codeReuseRatio: number;
}

export interface IArchitectureAnalyzer {
  analyze(files: ParsedFile[]): Promise<ArchitectureReport>;
  detectPattern(files: ParsedFile[]): PatternMatch;
  buildDependencyGraph(files: ParsedFile[]): DependencyGraph;
  identifyModules(files: ParsedFile[]): ModuleInfo[];
  identifyLayers(modules: ModuleInfo[]): LayerInfo[];
  identifyCoreFlows(files: ParsedFile[]): BusinessFlow[];
  detectDecisions(files: ParsedFile[]): TechnicalDecision[];
  calculateMetrics(modules: ModuleInfo[], graph: DependencyGraph): ArchitectureMetrics;
}

export interface IPatternDetector {
  detect(files: ParsedFile[]): PatternMatch[];
  getIndicators(pattern: ArchitecturePattern, files: ParsedFile[]): string[];
}

export interface IDependencyGraphBuilder {
  build(files: ParsedFile[]): DependencyGraph;
  addNode(graph: DependencyGraph, node: DependencyNode): void;
  addEdge(graph: DependencyGraph, edge: DependencyEdge): void;
  findCircularDependencies(graph: DependencyGraph): string[][];
  findOrphans(graph: DependencyGraph): DependencyNode[];
  findHubs(graph: DependencyGraph, threshold: number): DependencyNode[];
}
