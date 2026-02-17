export type DiagramType = 'layered' | 'component' | 'deployment' | 'sequence' | 'flowchart';

export type DiagramNodeType =
  | 'layer'
  | 'component'
  | 'service'
  | 'database'
  | 'external'
  | 'container'
  | 'actor';

export type DiagramEdgeType =
  | 'dependency'
  | 'dataflow'
  | 'communication'
  | 'inheritance'
  | 'implementation';

export interface ArchitectureDiagram {
  id: string;
  name: string;
  description?: string;
  type: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layers: DiagramLayer[];
  metadata: DiagramMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagramNode {
  id: string;
  label: string;
  type: DiagramNodeType;
  description?: string;
  position: Position;
  size: Size;
  style: DiagramNodeStyle;
  metadata?: Record<string, unknown>;
  children?: DiagramNode[];
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DiagramNodeStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontColor: string;
  icon?: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: DiagramEdgeType;
  label?: string;
  style: DiagramEdgeStyle;
  metadata?: Record<string, unknown>;
}

export interface DiagramEdgeStyle {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  arrow: 'none' | 'forward' | 'backward' | 'both';
  animated: boolean;
}

export interface DiagramLayer {
  id: string;
  name: string;
  description?: string;
  order: number;
  nodes: string[];
  style: LayerStyle;
}

export interface LayerStyle {
  backgroundColor: string;
  borderColor: string;
  labelPosition: 'top' | 'left' | 'bottom' | 'right';
}

export interface DiagramMetadata {
  projectName: string;
  version: string;
  author?: string;
  tags: string[];
  sourceFiles?: string[];
}

export type ExportFormat = 'mermaid' | 'svg' | 'png' | 'json' | 'drawio';

export interface ExportOptions {
  format: ExportFormat;
  style: DiagramStyle;
  layout: LayoutOptions;
  includeMetadata: boolean;
  scale: number;
  backgroundColor?: string;
}

export interface DiagramStyle {
  theme: 'light' | 'dark' | 'custom';
  colors: ColorScheme;
  fonts: FontConfig;
  spacing: SpacingConfig;
}

export interface ColorScheme {
  background: string;
  nodeDefault: string;
  nodeSelected: string;
  nodeHover: string;
  edgeDefault: string;
  edgeHighlight: string;
  text: string;
  textSecondary: string;
  layerBackgrounds: string[];
}

export interface FontConfig {
  family: string;
  size: number;
  weight: 'normal' | 'bold';
}

export interface SpacingConfig {
  nodePadding: number;
  layerPadding: number;
  edgeMargin: number;
}

export interface LayoutOptions {
  direction: 'top-to-bottom' | 'left-to-right' | 'bottom-to-top' | 'right-to-left';
  nodeSpacing: number;
  layerSpacing: number;
  rankAlignment: 'top' | 'center' | 'bottom';
  edgeRouting: 'straight' | 'orthogonal' | 'curved';
  compactMode: boolean;
}

export interface LayeredDiagramConfig {
  layers: LayerDefinition[];
  showDependencies: boolean;
  showDataFlow: boolean;
  groupByModule: boolean;
}

export interface LayerDefinition {
  name: string;
  patterns: string[];
  color: string;
  order: number;
}

export interface ComponentDiagramConfig {
  showInternals: boolean;
  showInterfaces: boolean;
  showDependencies: boolean;
  groupByNamespace: boolean;
}

export interface DeploymentDiagramConfig {
  environments: Environment[];
  showConnections: boolean;
  showDataFlow: boolean;
  includeInfrastructure: boolean;
}

export interface Environment {
  name: string;
  type: 'development' | 'staging' | 'production';
  nodes: DeploymentNode[];
}

export interface DeploymentNode {
  id: string;
  name: string;
  type:
    | 'server'
    | 'container'
    | 'database'
    | 'cache'
    | 'queue'
    | 'storage'
    | 'cdn'
    | 'loadbalancer';
  components: string[];
  connections: Connection[];
}

export interface Connection {
  target: string;
  type: 'http' | 'https' | 'tcp' | 'udp' | 'grpc' | 'websocket';
  description?: string;
}

export interface IArchitectureDiagramGenerator {
  generateLayeredDiagram(config: LayeredDiagramConfig): Promise<ArchitectureDiagram>;
  generateComponentDiagram(config: ComponentDiagramConfig): Promise<ArchitectureDiagram>;
  generateDeploymentDiagram(config: DeploymentDiagramConfig): Promise<ArchitectureDiagram>;
}

export interface IDiagramExporter {
  exportToMermaid(diagram: ArchitectureDiagram, options?: ExportOptions): string;
  exportToSVG(diagram: ArchitectureDiagram, options?: ExportOptions): string;
  exportToPNG(diagram: ArchitectureDiagram, options?: ExportOptions): Promise<Buffer>;
  exportToJSON(diagram: ArchitectureDiagram, options?: ExportOptions): string;
  exportToDrawIO(diagram: ArchitectureDiagram, options?: ExportOptions): string;
}

export const DEFAULT_DIAGRAM_STYLE: DiagramStyle = {
  theme: 'light',
  colors: {
    background: '#ffffff',
    nodeDefault: '#e3f2fd',
    nodeSelected: '#bbdefb',
    nodeHover: '#90caf9',
    edgeDefault: '#666666',
    edgeHighlight: '#1976d2',
    text: '#212121',
    textSecondary: '#757575',
    layerBackgrounds: ['#f5f5f5', '#eeeeee', '#e0e0e0', '#bdbdbd'],
  },
  fonts: {
    family: 'Arial, sans-serif',
    size: 12,
    weight: 'normal',
  },
  spacing: {
    nodePadding: 10,
    layerPadding: 20,
    edgeMargin: 5,
  },
};

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'top-to-bottom',
  nodeSpacing: 50,
  layerSpacing: 100,
  rankAlignment: 'center',
  edgeRouting: 'orthogonal',
  compactMode: false,
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'mermaid',
  style: DEFAULT_DIAGRAM_STYLE,
  layout: DEFAULT_LAYOUT_OPTIONS,
  includeMetadata: true,
  scale: 1,
  backgroundColor: '#ffffff',
};

export const NODE_TYPE_STYLES: Record<DiagramNodeType, Partial<DiagramNodeStyle>> = {
  layer: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    borderRadius: 4,
  },
  component: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    borderRadius: 8,
  },
  service: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    borderRadius: 12,
  },
  database: {
    backgroundColor: '#fce4ec',
    borderColor: '#e91e63',
    borderRadius: 0,
  },
  external: {
    backgroundColor: '#f3e5f5',
    borderColor: '#9c27b0',
    borderRadius: 4,
  },
  container: {
    backgroundColor: '#e0f7fa',
    borderColor: '#00bcd4',
    borderRadius: 4,
  },
  actor: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffc107',
    borderRadius: 50,
  },
};

export const EDGE_TYPE_STYLES: Record<DiagramEdgeType, Partial<DiagramEdgeStyle>> = {
  dependency: {
    color: '#666666',
    style: 'solid',
    arrow: 'forward',
  },
  dataflow: {
    color: '#2196f3',
    style: 'solid',
    arrow: 'forward',
    animated: true,
  },
  communication: {
    color: '#4caf50',
    style: 'dashed',
    arrow: 'both',
  },
  inheritance: {
    color: '#9c27b0',
    style: 'solid',
    arrow: 'forward',
  },
  implementation: {
    color: '#ff9800',
    style: 'dashed',
    arrow: 'forward',
  },
};
