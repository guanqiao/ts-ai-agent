export type KnowledgeNodeType = 'concept' | 'api' | 'pattern' | 'component' | 'module' | 'page' | 'decision';

export interface KnowledgeNodeMetadata {
  stability?: 'stable' | 'experimental' | 'deprecated';
  tags: string[];
  importance?: number;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  name: string;
  description?: string;
  content?: string;
  tags: string[];
  weight: number;
  relatedCount: number;
  importance: number;
  metadata: KnowledgeNodeMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  sourceId: string;
  target: string;
  targetId: string;
  type: 'related' | 'dependsOn' | 'implements' | 'extends' | 'references';
  weight: number;
  label?: string;
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  centrality: number;
  cohesion?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    buildTime: Date;
  };
}

export interface RecommendationContext {
  currentPageId?: string;
  recentlyViewed?: string[];
  searchQuery?: string;
  userRole?: string;
}

export interface RecommendationReason {
  type: 'content' | 'structure' | 'usage' | 'similarity';
  weight: number;
  description: string;
}

export interface Recommendation {
  id: string;
  nodeId: string;
  score: number;
  reason: string | RecommendationReason[];
  type: 'related' | 'learning' | 'complementary';
  weight?: number;
}

export interface LearningPathNode {
  nodeId: string;
  position: number;
  estimatedTime: number;
  prerequisites: string[];
}

export interface LearningPath {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  nodes: LearningPathNode[];
  estimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface KnowledgePath {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  length: number;
  weight: number;
}

export interface NodeRelation {
  sourceId: string;
  targetId: string;
  strength: number;
  pathLength: number;
  commonNeighbors: number;
}

export interface MitigationStrategy {
  id: string;
  type: 'avoid' | 'reduce' | 'transfer' | 'accept';
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedEffort: number;
}
