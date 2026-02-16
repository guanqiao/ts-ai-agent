import * as crypto from 'crypto';
import { WikiPage } from '../types';
import {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeCluster,
  KnowledgeGraphQuery,
  KnowledgeGraphQueryResult,
  KnowledgePath,
  Recommendation,
  RecommendationContext,
  LearningPath,
  IKnowledgeGraphService,
} from './types';
import { NodeExtractor } from './node-extractor';
import { EdgeBuilder } from './edge-builder';
import { RecommendationService } from './recommendation';

export class KnowledgeGraphService implements IKnowledgeGraphService {
  private nodeExtractor: NodeExtractor;
  private edgeBuilder: EdgeBuilder;
  private recommendationService: RecommendationService;
  private graph: KnowledgeGraph | null = null;

  constructor() {
    this.nodeExtractor = new NodeExtractor();
    this.edgeBuilder = new EdgeBuilder();
    this.recommendationService = new RecommendationService();
  }

  async build(pages: WikiPage[]): Promise<KnowledgeGraph> {
    const conceptNodes = this.nodeExtractor.extractConcepts(pages);
    const apiNodes = this.nodeExtractor.extractAPIs(pages);
    const patternNodes = this.nodeExtractor.extractPatterns(pages);

    const allNodes = [...conceptNodes, ...apiNodes, ...patternNodes];

    const directEdges = this.edgeBuilder.buildEdges(allNodes, pages);
    const inferredEdges = this.edgeBuilder.inferRelations(allNodes, directEdges);
    const allEdges = [...directEdges, ...inferredEdges];

    const clusters = this.edgeBuilder.clusterNodes(allNodes, allEdges);

    const graph: KnowledgeGraph = {
      id: this.generateGraphId(),
      name: 'Project Knowledge Graph',
      description: 'Knowledge graph built from wiki pages',
      nodes: new Map(allNodes.map((n) => [n.id, n])),
      edges: new Map(allEdges.map((e) => [e.id, e])),
      clusters: new Map(clusters.map((c) => [c.id, c])),
      metadata: this.calculateMetadata(allNodes, allEdges, clusters),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.graph = graph;
    this.recommendationService.setGraph(graph);

    return graph;
  }

  async query(query: KnowledgeGraphQuery): Promise<KnowledgeGraphQueryResult> {
    if (!this.graph) {
      return { nodes: [], edges: [], paths: [], total: 0 };
    }

    let nodes = Array.from(this.graph.nodes.values());
    let edges = Array.from(this.graph.edges.values());

    if (query.nodeId) {
      nodes = nodes.filter((n) => n.id === query.nodeId);
    }

    if (query.nodeType) {
      nodes = nodes.filter((n) => n.type === query.nodeType);
    }

    if (query.searchTerm) {
      const term = query.searchTerm.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(term) ||
          n.description?.toLowerCase().includes(term) ||
          n.metadata.tags.some((t) => t.toLowerCase().includes(term))
      );
    }

    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map((t) => t.toLowerCase()));
      nodes = nodes.filter((n) => n.metadata.tags.some((t) => tagSet.has(t.toLowerCase())));
    }

    if (query.minImportance !== undefined) {
      nodes = nodes.filter((n) => n.importance >= query.minImportance!);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

    if (query.edgeType) {
      edges = edges.filter((e) => e.type === query.edgeType);
    }

    const total = nodes.length;

    if (query.offset !== undefined) {
      nodes = nodes.slice(query.offset);
    }

    if (query.limit !== undefined) {
      nodes = nodes.slice(0, query.limit);
    }

    const paths = this.findPathsForNodes(nodes, query.maxDepth || 2);

    return { nodes, edges, paths, total };
  }

  async findRelated(nodeId: string, maxDepth?: number): Promise<KnowledgeNode[]> {
    return this.recommendationService.findRelated(nodeId, maxDepth);
  }

  async getLearningPath(startNodeId: string, endNodeId: string): Promise<LearningPath | null> {
    return this.recommendationService.getLearningPath(startNodeId, endNodeId);
  }

  async recommend(context: RecommendationContext): Promise<Recommendation[]> {
    return this.recommendationService.recommend(context);
  }

  async export(format: 'json' | 'graphml' | 'gexf'): Promise<string> {
    if (!this.graph) {
      throw new Error('No graph available. Build the graph first.');
    }

    switch (format) {
      case 'json':
        return this.exportToJSON();
      case 'graphml':
        return this.exportToGraphML();
      case 'gexf':
        return this.exportToGEXF();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async import(data: string, format: 'json' | 'graphml' | 'gexf'): Promise<KnowledgeGraph> {
    switch (format) {
      case 'json':
        return this.importFromJSON(data);
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  getGraph(): KnowledgeGraph | null {
    return this.graph;
  }

  getNode(nodeId: string): KnowledgeNode | undefined {
    return this.graph?.nodes.get(nodeId);
  }

  getEdge(edgeId: string): KnowledgeEdge | undefined {
    return this.graph?.edges.get(edgeId);
  }

  getCluster(clusterId: string): KnowledgeCluster | undefined {
    return this.graph?.clusters.get(clusterId);
  }

  getStatistics(): {
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    avgConnectivity: number;
  } {
    if (!this.graph) {
      return { nodeCount: 0, edgeCount: 0, clusterCount: 0, avgConnectivity: 0 };
    }

    return {
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.size,
      clusterCount: this.graph.clusters.size,
      avgConnectivity: this.graph.metadata.avgConnectivity,
    };
  }

  private calculateMetadata(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    clusters: KnowledgeCluster[]
  ): KnowledgeGraph['metadata'] {
    const nodeConnectivity = new Map<string, number>();

    for (const edge of edges) {
      nodeConnectivity.set(edge.sourceId, (nodeConnectivity.get(edge.sourceId) || 0) + 1);
      nodeConnectivity.set(edge.targetId, (nodeConnectivity.get(edge.targetId) || 0) + 1);
    }

    const totalConnectivity = Array.from(nodeConnectivity.values()).reduce((sum, c) => sum + c, 0);
    const avgConnectivity = nodes.length > 0 ? totalConnectivity / nodes.length : 0;

    const maxDepth = this.calculateMaxDepth(nodes, edges);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: clusters.length,
      avgConnectivity,
      maxDepth,
      version: '1.0.0',
    };
  }

  private calculateMaxDepth(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): number {
    if (nodes.length === 0) return 0;

    const adjacencyList = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!adjacencyList.has(edge.sourceId)) {
        adjacencyList.set(edge.sourceId, new Set());
      }
      adjacencyList.get(edge.sourceId)!.add(edge.targetId);
    }

    let maxDepth = 0;
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor, depth + 1);
        }
      }
    };

    for (const node of nodes) {
      visited.clear();
      dfs(node.id, 0);
    }

    return maxDepth;
  }

  private findPathsForNodes(nodes: KnowledgeNode[], maxDepth: number): KnowledgePath[] {
    if (!this.graph || nodes.length < 2) return [];

    const paths: KnowledgePath[] = [];

    for (let i = 0; i < Math.min(nodes.length, 10); i++) {
      for (let j = i + 1; j < Math.min(nodes.length, 10); j++) {
        const path = this.findPathBetween(nodes[i].id, nodes[j].id, maxDepth);
        if (path && path.length <= maxDepth + 1) {
          paths.push(path);
        }
      }
    }

    return paths;
  }

  private findPathBetween(startId: string, endId: string, maxDepth: number): KnowledgePath | null {
    if (!this.graph) return null;

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [startId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (path.length > maxDepth + 1) continue;

      if (nodeId === endId) {
        return this.buildPath(path);
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      for (const edge of this.graph.edges.values()) {
        let nextNodeId: string | null = null;

        if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
          nextNodeId = edge.targetId;
        } else if (edge.targetId === nodeId && !visited.has(edge.sourceId)) {
          nextNodeId = edge.sourceId;
        }

        if (nextNodeId) {
          queue.push({ nodeId: nextNodeId, path: [...path, nextNodeId] });
        }
      }
    }

    return null;
  }

  private buildPath(nodeIds: string[]): KnowledgePath {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (const nodeId of nodeIds) {
      const node = this.graph!.nodes.get(nodeId);
      if (node) nodes.push(node);
    }

    for (let i = 0; i < nodeIds.length - 1; i++) {
      for (const edge of this.graph!.edges.values()) {
        if (
          (edge.sourceId === nodeIds[i] && edge.targetId === nodeIds[i + 1]) ||
          (edge.targetId === nodeIds[i] && edge.sourceId === nodeIds[i + 1])
        ) {
          edges.push(edge);
          break;
        }
      }
    }

    return {
      startNodeId: nodeIds[0],
      endNodeId: nodeIds[nodeIds.length - 1],
      nodes,
      edges,
      length: nodes.length,
      weight: edges.reduce((sum, e) => sum + e.weight, 0),
    };
  }

  private exportToJSON(): string {
    if (!this.graph) return '{}';

    const exportData = {
      id: this.graph.id,
      name: this.graph.name,
      description: this.graph.description,
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      clusters: Array.from(this.graph.clusters.values()),
      metadata: this.graph.metadata,
      createdAt: this.graph.createdAt,
      updatedAt: this.graph.updatedAt,
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportToGraphML(): string {
    if (!this.graph) return '';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <key id="name" for="node" attr.name="name" attr.type="string"/>\n';
    xml += '  <key id="type" for="node" attr.name="type" attr.type="string"/>\n';
    xml += '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>\n';
    xml += '  <key id="edgeType" for="edge" attr.name="type" attr.type="string"/>\n';
    xml += '  <graph id="' + this.graph.id + '" edgedefault="undirected">\n';

    for (const node of this.graph.nodes.values()) {
      xml += `    <node id="${node.id}">\n`;
      xml += `      <data key="name">${this.escapeXml(node.name)}</data>\n`;
      xml += `      <data key="type">${node.type}</data>\n`;
      xml += `    </node>\n`;
    }

    for (const edge of this.graph.edges.values()) {
      xml += `    <edge source="${edge.sourceId}" target="${edge.targetId}">\n`;
      xml += `      <data key="weight">${edge.weight}</data>\n`;
      xml += `      <data key="edgeType">${edge.type}</data>\n`;
      xml += `    </edge>\n`;
    }

    xml += '  </graph>\n';
    xml += '</graphml>';

    return xml;
  }

  private exportToGEXF(): string {
    if (!this.graph) return '';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n';
    xml += '  <meta lastmodifieddate="' + new Date().toISOString().split('T')[0] + '">\n';
    xml += '    <creator>KnowledgeGraphService</creator>\n';
    xml += '    <description>' + (this.graph.description || '') + '</description>\n';
    xml += '  </meta>\n';
    xml += '  <graph mode="static" defaultedgetype="undirected">\n';
    xml += '    <attributes class="node">\n';
    xml += '      <attribute id="0" title="type" type="string"/>\n';
    xml += '      <attribute id="1" title="importance" type="float"/>\n';
    xml += '    </attributes>\n';
    xml += '    <nodes>\n';

    for (const node of this.graph.nodes.values()) {
      xml += `      <node id="${node.id}" label="${this.escapeXml(node.name)}">\n`;
      xml += `        <attvalues>\n`;
      xml += `          <attvalue for="0" value="${node.type}"/>\n`;
      xml += `          <attvalue for="1" value="${node.importance}"/>\n`;
      xml += `        </attvalues>\n`;
      xml += `      </node>\n`;
    }

    xml += '    </nodes>\n';
    xml += '    <edges>\n';

    let edgeId = 0;
    for (const edge of this.graph.edges.values()) {
      xml += `      <edge id="${edgeId++}" source="${edge.sourceId}" target="${edge.targetId}" weight="${edge.weight}"/>\n`;
    }

    xml += '    </edges>\n';
    xml += '  </graph>\n';
    xml += '</gexf>';

    return xml;
  }

  private importFromJSON(data: string): KnowledgeGraph {
    const parsed = JSON.parse(data);

    const graph: KnowledgeGraph = {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      nodes: new Map(parsed.nodes.map((n: KnowledgeNode) => [n.id, n])),
      edges: new Map(parsed.edges.map((e: KnowledgeEdge) => [e.id, e])),
      clusters: new Map(parsed.clusters.map((c: KnowledgeCluster) => [c.id, c])),
      metadata: parsed.metadata,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
    };

    this.graph = graph;
    this.recommendationService.setGraph(graph);

    return graph;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private generateGraphId(): string {
    const hash = crypto
      .createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 12);
    return `kg-${hash}`;
  }
}
