import { ParsedFile } from '../../types';
import { ArchitectureReport } from '../../architecture/types';

export type GraphType = 
  | 'dependency' 
  | 'reference' 
  | 'call-graph' 
  | 'inheritance'
  | 'implementation';

export type GraphFormat = 
  | 'mermaid' 
  | 'svg' 
  | 'json'
  | 'dot';

export interface GraphOptions {
  maxDepth: number;
  excludePatterns: string[];
  includeExternal: boolean;
  highlightCycles: boolean;
  groupByLayer: boolean;
  showLabels: boolean;
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  theme: GraphTheme;
}

export interface GraphTheme {
  nodeColors: Record<string, string>;
  edgeColors: Record<string, string>;
  highlightColor: string;
  backgroundColor: string;
  fontSize: number;
  fontFamily: string;
}

export interface Graph {
  id: string;
  type: GraphType;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  module?: string;
  layer?: string;
  path?: string;
  line?: number;
  metadata?: Record<string, unknown>;
  style?: NodeStyle;
}

export type NodeType = 
  | 'module'
  | 'file'
  | 'class'
  | 'interface'
  | 'function'
  | 'method'
  | 'variable'
  | 'namespace';

export interface NodeStyle {
  shape: 'box' | 'ellipse' | 'diamond' | 'hexagon' | 'circle';
  color: string;
  fillColor: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  borderStyle: 'solid' | 'dashed' | 'dotted';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  weight: number;
  metadata?: Record<string, unknown>;
  style?: EdgeStyle;
}

export type EdgeType = 
  | 'imports'
  | 'extends'
  | 'implements'
  | 'calls'
  | 'references'
  | 'depends-on'
  | 'contains';

export interface EdgeStyle {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  arrowHead: 'normal' | 'vee' | 'diamond' | 'none';
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  style?: ClusterStyle;
}

export interface ClusterStyle {
  fillColor: string;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
}

export interface GraphMetadata {
  generatedAt: Date;
  sourceFiles: number;
  totalNodes: number;
  totalEdges: number;
  hasCycles: boolean;
  cycles: string[][];
  maxDepth: number;
}

export interface IWikiGraphGenerator {
  generateDependencyGraph(
    parsedFiles: ParsedFile[], 
    architecture?: ArchitectureReport
  ): Promise<Graph>;
  
  generateCallGraph(parsedFiles: ParsedFile[]): Promise<Graph>;
  
  generateInheritanceGraph(parsedFiles: ParsedFile[]): Promise<Graph>;
  
  generateImplementationGraph(parsedFiles: ParsedFile[]): Promise<Graph>;
  
  exportToMermaid(graph: Graph, options?: Partial<GraphOptions>): string;
  
  exportToSVG(graph: Graph, options?: Partial<GraphOptions>): string;
  
  exportToJSON(graph: Graph): string;
  
  exportToDot(graph: Graph, options?: Partial<GraphOptions>): string;
  
  detectCycles(graph: Graph): string[][];
  
  filterGraph(graph: Graph, filter: GraphFilter): Graph;
}

export interface GraphFilter {
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  modules?: string[];
  excludePatterns?: string[];
  maxNodes?: number;
  minWeight?: number;
}

export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  maxDepth: 10,
  excludePatterns: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  includeExternal: false,
  highlightCycles: true,
  groupByLayer: true,
  showLabels: true,
  direction: 'TB',
  theme: {
    nodeColors: {
      module: '#4A90D9',
      file: '#6DB65B',
      class: '#D9A0D9',
      interface: '#D9D066',
      function: '#D96666',
      method: '#D96666',
      variable: '#66D9D9',
      namespace: '#D99A66',
    },
    edgeColors: {
      imports: '#666666',
      extends: '#D94A4A',
      implements: '#4AD94A',
      calls: '#4A4AD9',
      references: '#D9D94A',
      'depends-on': '#D94AD9',
      contains: '#4AD9D9',
    },
    highlightColor: '#FF4444',
    backgroundColor: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
  },
};

export const DEFAULT_NODE_STYLE: NodeStyle = {
  shape: 'box',
  color: '#333333',
  fillColor: '#FFFFFF',
  fontSize: 12,
  fontWeight: 'normal',
  borderStyle: 'solid',
};

export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#666666',
  width: 1,
  style: 'solid',
  arrowHead: 'normal',
};
