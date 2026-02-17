import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, KnowledgeCluster } from './types';

export class KnowledgeGraphService {
  private graph: KnowledgeGraph | null = null;

  async build(): Promise<KnowledgeGraph> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const clusters: KnowledgeCluster[] = [];

    this.graph = {
      nodes,
      edges,
      clusters,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalClusters: clusters.length,
        buildTime: new Date(),
      },
    };

    return this.graph;
  }

  async query(
    query: string,
    options?: {
      limit?: number;
      types?: KnowledgeNode['type'][];
      clusters?: string[];
    }
  ): Promise<KnowledgeNode[]> {
    if (!this.graph) {
      throw new Error('Knowledge graph not built yet');
    }

    const { limit = 10, types, clusters } = options || {};
    let results = this.graph.nodes;

    if (types) {
      results = results.filter((node) => types.includes(node.type));
    }

    if (clusters) {
      const clusterNodeIds = new Set(
        this.graph.clusters
          .filter((cluster) => clusters.includes(cluster.id))
          .flatMap((cluster) => cluster.nodeIds)
      );
      results = results.filter((node) => clusterNodeIds.has(node.id));
    }

    results = results
      .filter(
        (node) =>
          node.title.toLowerCase().includes(query.toLowerCase()) ||
          node.description?.toLowerCase().includes(query.toLowerCase()) ||
          node.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      )
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    return results;
  }

  async export(format: 'json' | 'csv' | 'graphml'): Promise<string> {
    if (!this.graph) {
      throw new Error('Knowledge graph not built yet');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(this.graph, null, 2);
      case 'csv':
        return this.exportToCSV();
      case 'graphml':
        return this.exportToGraphML();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToCSV(): string {
    if (!this.graph) {
      return '';
    }

    const headers = 'id,type,title,description,tags,weight,relatedCount';
    const rows = this.graph.nodes.map((node) =>
      [
        node.id,
        node.type,
        `"${node.title.replace(/"/g, '""')}"`,
        `"${node.description?.replace(/"/g, '""') || ''}"`,
        `"${node.tags.join(', ')}"`,
        node.weight,
        node.relatedCount,
      ].join(',')
    );

    return [headers, ...rows].join('\n');
  }

  private exportToGraphML(): string {
    if (!this.graph) {
      return '';
    }

    let graphml =
      '<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">';
    graphml += '<key id="type" for="node" attr.name="type" attr.type="string"/>';
    graphml += '<key id="weight" for="node" attr.name="weight" attr.type="double"/>';
    graphml += '<key id="edgeType" for="edge" attr.name="type" attr.type="string"/>';
    graphml += '<graph id="G" edgedefault="directed">';

    this.graph.nodes.forEach((node) => {
      graphml += `<node id="${node.id}">`;
      graphml += `<data key="type">${node.type}</data>`;
      graphml += `<data key="weight">${node.weight}</data>`;
      graphml += '</node>';
    });

    this.graph.edges.forEach((edge) => {
      graphml += `<edge source="${edge.source}" target="${edge.target}">`;
      graphml += `<data key="edgeType">${edge.type}</data>`;
      graphml += '</edge>';
    });

    graphml += '</graph></graphml>';
    return graphml;
  }

  async getRelatedNodes(nodeId: string, limit?: number): Promise<KnowledgeNode[]> {
    if (!this.graph) {
      throw new Error('Knowledge graph not built yet');
    }

    const relatedNodeIds = new Set(
      this.graph.edges
        .filter((edge) => edge.source === nodeId || edge.target === nodeId)
        .map((edge) => (edge.source === nodeId ? edge.target : edge.source))
    );

    return this.graph.nodes
      .filter((node) => relatedNodeIds.has(node.id))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  async getClusters(): Promise<KnowledgeCluster[]> {
    if (!this.graph) {
      throw new Error('Knowledge graph not built yet');
    }

    return this.graph.clusters;
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    if (!this.graph) {
      throw new Error('Knowledge graph not built yet');
    }

    return this.graph.nodes.find((node) => node.id === id) || null;
  }
}
