export type DiagramType = 
  | 'flowchart' 
  | 'sequence' 
  | 'class' 
  | 'state' 
  | 'er' 
  | 'gantt' 
  | 'pie' 
  | 'mindmap'
  | 'architecture'
  | 'dependency';

export type DiagramFormat = 'mermaid' | 'plantuml' | 'graphviz';

export interface DiagramNode {
  id: string;
  label: string;
  type: DiagramNodeType;
  shape?: NodeShape;
  style?: NodeStyle;
  metadata?: Record<string, unknown>;
}

export type DiagramNodeType = 
  | 'class' 
  | 'interface' 
  | 'module' 
  | 'function' 
  | 'variable' 
  | 'process' 
  | 'decision' 
  | 'database'
  | 'external';

export type NodeShape = 
  | 'rectangle' 
  | 'rounded' 
  | 'circle' 
  | 'diamond' 
  | 'hexagon' 
  | 'parallelogram'
  | 'cylinder';

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontColor?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: EdgeType;
  style?: EdgeStyle;
}

export type EdgeType = 
  | 'association' 
  | 'dependency' 
  | 'inheritance' 
  | 'implementation' 
  | 'composition' 
  | 'aggregation' 
  | 'flow' 
  | 'data';

export interface EdgeStyle {
  line?: 'solid' | 'dashed' | 'dotted';
  arrow?: 'normal' | 'open' | 'none' | 'both';
  color?: string;
  thickness?: number;
}

export interface DiagramCluster {
  id: string;
  label: string;
  nodes: string[];
  style?: ClusterStyle;
}

export interface ClusterStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface Diagram {
  id: string;
  type: DiagramType;
  title: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  clusters: DiagramCluster[];
  metadata: DiagramMetadata;
}

export interface DiagramMetadata {
  createdAt: Date;
  updatedAt: Date;
  version: string;
  sourceFiles: string[];
  generator: string;
}

export interface ArchitectureDiagramConfig {
  showLayers: boolean;
  showModules: boolean;
  showDependencies: boolean;
  showInterfaces: boolean;
  maxDepth: number;
  layout: 'hierarchical' | 'force' | 'circular';
  direction: 'top-bottom' | 'left-right' | 'bottom-top' | 'right-left';
}

export interface DependencyDiagramConfig {
  showExternal: boolean;
  showInternal: boolean;
  showCircular: boolean;
  maxDepth: number;
  filter: string[];
  excludePatterns: string[];
}

export interface FlowDiagramConfig {
  showDecisions: boolean;
  showLoops: boolean;
  showParallel: boolean;
  orientation: 'vertical' | 'horizontal';
  startNode?: string;
  endNode?: string;
}

export interface SequenceDiagramConfig {
  showLifelines: boolean;
  showActivations: boolean;
  showNotes: boolean;
  showLoops: boolean;
  showAlts: boolean;
  maxParticipants: number;
}

export interface IDiagramGenerator {
  generate(config: DiagramConfig): Promise<Diagram>;
  export(diagram: Diagram, format: DiagramFormat): string;
}

export type DiagramConfig = 
  | ArchitectureDiagramConfig 
  | DependencyDiagramConfig 
  | FlowDiagramConfig 
  | SequenceDiagramConfig;

export interface MermaidOptions {
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  fontFamily: string;
  fontSize: number;
  curve: 'basis' | 'linear' | 'cardinal';
}

export interface DiagramRenderResult {
  diagram: Diagram;
  code: string;
  format: DiagramFormat;
  preview?: string;
}

export const DEFAULT_MERMAID_OPTIONS: MermaidOptions = {
  theme: 'default',
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  curve: 'basis',
};

export const DEFAULT_ARCHITECTURE_CONFIG: ArchitectureDiagramConfig = {
  showLayers: true,
  showModules: true,
  showDependencies: true,
  showInterfaces: true,
  maxDepth: 3,
  layout: 'hierarchical',
  direction: 'top-bottom',
};

export const DEFAULT_DEPENDENCY_CONFIG: DependencyDiagramConfig = {
  showExternal: false,
  showInternal: true,
  showCircular: true,
  maxDepth: 3,
  filter: [],
  excludePatterns: ['node_modules', 'dist', 'build'],
};

export const DEFAULT_FLOW_CONFIG: FlowDiagramConfig = {
  showDecisions: true,
  showLoops: true,
  showParallel: true,
  orientation: 'vertical',
};
