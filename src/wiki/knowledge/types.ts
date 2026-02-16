import { WikiPage, WikiCategory } from '../types';

export type KnowledgeNodeType =
  | 'concept'
  | 'api'
  | 'pattern'
  | 'module'
  | 'class'
  | 'function'
  | 'interface'
  | 'decision';

export type KnowledgeEdgeType =
  | 'depends-on'
  | 'implements'
  | 'extends'
  | 'calls'
  | 'references'
  | 'contains'
  | 'related-to'
  | 'supersedes';

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  name: string;
  description?: string;
  sourcePageId?: string;
  sourceFile?: string;
  metadata: KnowledgeNodeMetadata;
  embedding?: number[];
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeNodeMetadata {
  tags: string[];
  category?: WikiCategory;
  visibility: 'public' | 'internal' | 'private';
  stability: 'stable' | 'experimental' | 'deprecated';
  version?: string;
  custom?: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: KnowledgeEdgeType;
  weight: number;
  metadata: KnowledgeEdgeMetadata;
  createdAt: Date;
}

export interface KnowledgeEdgeMetadata {
  inferred: boolean;
  confidence: number;
  source?: string;
  custom?: Record<string, unknown>;
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  centroid?: number[];
  cohesion: number;
  dominantType: KnowledgeNodeType;
  tags: string[];
  createdAt: Date;
}

export interface KnowledgeGraph {
  id: string;
  name: string;
  description?: string;
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, KnowledgeEdge>;
  clusters: Map<string, KnowledgeCluster>;
  metadata: KnowledgeGraphMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeGraphMetadata {
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  avgConnectivity: number;
  maxDepth: number;
  version: string;
}

export interface KnowledgeGraphQuery {
  nodeId?: string;
  nodeType?: KnowledgeNodeType;
  edgeType?: KnowledgeEdgeType;
  searchTerm?: string;
  tags?: string[];
  minImportance?: number;
  maxDepth?: number;
  limit?: number;
  offset?: number;
}

export interface KnowledgeGraphQueryResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  paths: KnowledgePath[];
  total: number;
}

export interface KnowledgePath {
  startNodeId: string;
  endNodeId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  length: number;
  weight: number;
}

export interface IKnowledgeGraphService {
  build(pages: WikiPage[]): Promise<KnowledgeGraph>;
  query(query: KnowledgeGraphQuery): Promise<KnowledgeGraphQueryResult>;
  findRelated(nodeId: string, maxDepth?: number): Promise<KnowledgeNode[]>;
  getLearningPath(startNodeId: string, endNodeId: string): Promise<LearningPath | null>;
  recommend(context: RecommendationContext): Promise<Recommendation[]>;
  export(format: 'json' | 'graphml' | 'gexf'): Promise<string>;
  import(data: string, format: 'json' | 'graphml' | 'gexf'): Promise<KnowledgeGraph>;
}

export interface RecommendationContext {
  currentPageId?: string;
  recentNodeIds?: string[];
  searchTerms?: string[];
  userRole?: string;
  taskType?: 'learning' | 'development' | 'review' | 'debugging';
  limit?: number;
}

export interface Recommendation {
  node: KnowledgeNode;
  score: number;
  reason: RecommendationReason[];
  relatedNodes: KnowledgeNode[];
}

export interface RecommendationReason {
  type: 'related' | 'prerequisite' | 'frequently-accessed' | 'recently-updated' | 'high-importance';
  description: string;
  weight: number;
}

export interface LearningPath {
  id: string;
  name: string;
  description?: string;
  nodes: LearningPathNode[];
  estimatedTime?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  createdAt: Date;
}

export interface LearningPathNode {
  node: KnowledgeNode;
  order: number;
  isOptional: boolean;
  estimatedTime?: number;
  description?: string;
}

export interface NodeRelation {
  sourceId: string;
  targetId: string;
  type: KnowledgeEdgeType;
  strength: number;
  bidirectional: boolean;
}

export interface GraphExportOptions {
  includeMetadata: boolean;
  includeEmbeddings: boolean;
  includeClusters: boolean;
  format: 'json' | 'graphml' | 'gexf' | 'mermaid';
  prettyPrint: boolean;
}

export interface GraphImportOptions {
  mergeStrategy: 'replace' | 'merge' | 'append';
  validateNodes: boolean;
  validateEdges: boolean;
}
