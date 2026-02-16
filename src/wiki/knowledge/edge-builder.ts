import * as crypto from 'crypto';
import { WikiPage } from '../types';
import {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeCluster,
  KnowledgeEdgeType,
  KnowledgeEdgeMetadata,
  KnowledgeNodeType,
} from './types';

export class EdgeBuilder {
  private relationPatterns: Map<KnowledgeEdgeType, RegExp[]>;

  constructor() {
    this.relationPatterns = new Map([
      [
        'depends-on',
        [/import\s+.*from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
      ],
      ['implements', [/implements\s+(\w+)/g, /:\s*(\w+)Interface/g]],
      ['extends', [/extends\s+(\w+)/g, /:\s*(\w+)Base/g]],
      ['calls', [/(\w+)\s*\(/g, /\.(\w+)\s*\(/g]],
      ['references', [/@see\s+(\w+)/g, /see\s*\[([^\]]+)\]/g]],
    ]);
  }

  buildEdges(nodes: KnowledgeNode[], pages: WikiPage[]): KnowledgeEdge[] {
    const edges: KnowledgeEdge[] = [];
    const nodeMap = this.buildNodeMap(nodes);
    const processedPairs = new Set<string>();

    for (const page of pages) {
      const pageNodes = nodes.filter((n) => n.sourcePageId === page.id);

      for (const node of pageNodes) {
        const relatedNodes = this.findRelatedNodesInPage(node, page, nodeMap);

        for (const related of relatedNodes) {
          const pairKey = this.getPairKey(node.id, related.node.id);

          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);

            const edge = this.createEdge(
              node.id,
              related.node.id,
              related.type,
              related.weight,
              false
            );
            edges.push(edge);
          }
        }
      }
    }

    return edges;
  }

  inferRelations(nodes: KnowledgeNode[], existingEdges: KnowledgeEdge[]): KnowledgeEdge[] {
    const inferredEdges: KnowledgeEdge[] = [];
    const existingPairs = new Set<string>();

    for (const edge of existingEdges) {
      existingPairs.add(this.getPairKey(edge.sourceId, edge.targetId));
    }

    const typeRelations: Array<{
      from: string;
      to: string;
      edgeType: KnowledgeEdgeType;
      weight: number;
    }> = [
      { from: 'class', to: 'interface', edgeType: 'implements', weight: 0.8 },
      { from: 'class', to: 'class', edgeType: 'extends', weight: 0.7 },
      { from: 'function', to: 'class', edgeType: 'calls', weight: 0.5 },
      { from: 'function', to: 'function', edgeType: 'calls', weight: 0.6 },
      { from: 'pattern', to: 'class', edgeType: 'related-to', weight: 0.6 },
      { from: 'concept', to: 'concept', edgeType: 'related-to', weight: 0.4 },
    ];

    for (const relation of typeRelations) {
      const sourceNodes = nodes.filter((n) => n.type === relation.from);
      const targetNodes = nodes.filter((n) => n.type === relation.to);

      for (const source of sourceNodes) {
        for (const target of targetNodes) {
          if (source.id === target.id) continue;

          const pairKey = this.getPairKey(source.id, target.id);
          if (existingPairs.has(pairKey)) continue;

          const similarity = this.calculateNodeSimilarity(source, target);

          if (similarity > 0.3) {
            existingPairs.add(pairKey);

            const edge = this.createEdge(
              source.id,
              target.id,
              relation.edgeType,
              similarity * relation.weight,
              true
            );
            inferredEdges.push(edge);
          }
        }
      }
    }

    for (const node of nodes) {
      if (node.embedding) {
        const similarNodes = this.findSimilarNodesByEmbedding(node, nodes);

        for (const similar of similarNodes) {
          const pairKey = this.getPairKey(node.id, similar.node.id);
          if (existingPairs.has(pairKey)) continue;

          existingPairs.add(pairKey);

          const edge = this.createEdge(
            node.id,
            similar.node.id,
            'related-to',
            similar.similarity * 0.5,
            true
          );
          inferredEdges.push(edge);
        }
      }
    }

    return inferredEdges;
  }

  clusterNodes(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): KnowledgeCluster[] {
    const clusters: KnowledgeCluster[] = [];
    const visited = new Set<string>();
    const adjacencyList = this.buildAdjacencyList(edges);

    const typeGroups = this.groupNodesByType(nodes);

    for (const [, typeNodes] of typeGroups) {
      const typeClusters = this.findClustersInGroup(typeNodes, adjacencyList, visited);
      clusters.push(...typeClusters);
    }

    const remainingNodes = nodes.filter((n) => !visited.has(n.id));
    if (remainingNodes.length > 0) {
      const remainingClusters = this.clusterBySimilarity(remainingNodes);
      for (const cluster of remainingClusters) {
        for (const nodeId of cluster.nodeIds) {
          visited.add(nodeId);
        }
      }
      clusters.push(...remainingClusters);
    }

    return clusters;
  }

  findCommunities(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): KnowledgeCluster[] {
    const communities: KnowledgeCluster[] = [];
    const adjacencyList = this.buildAdjacencyList(edges);
    const nodeMap = this.buildNodeMap(nodes);

    const modularityClusters = this.detectModularityCommunities(nodes, edges, adjacencyList);

    for (const clusterNodes of modularityClusters) {
      if (clusterNodes.length < 2) continue;

      const cluster = this.createCluster(clusterNodes, nodeMap, adjacencyList);
      communities.push(cluster);
    }

    return communities;
  }

  private buildNodeMap(nodes: KnowledgeNode[]): Map<string, KnowledgeNode> {
    const map = new Map<string, KnowledgeNode>();
    for (const node of nodes) {
      map.set(node.id, node);
      map.set(node.name.toLowerCase(), node);
    }
    return map;
  }

  private findRelatedNodesInPage(
    node: KnowledgeNode,
    page: WikiPage,
    nodeMap: Map<string, KnowledgeNode>
  ): Array<{ node: KnowledgeNode; type: KnowledgeEdgeType; weight: number }> {
    const related: Array<{ node: KnowledgeNode; type: KnowledgeEdgeType; weight: number }> = [];

    const content = page.content;

    for (const [edgeType, patterns] of this.relationPatterns) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
          const refName = match[1];
          const relatedNode = nodeMap.get(refName.toLowerCase());

          if (relatedNode && relatedNode.id !== node.id) {
            related.push({
              node: relatedNode,
              type: edgeType,
              weight: 0.8,
            });
          }
        }
      }
    }

    const words = content.toLowerCase().split(/\s+/);
    for (const word of words) {
      const relatedNode = nodeMap.get(word);
      if (relatedNode && relatedNode.id !== node.id) {
        const existingRelation = related.find((r) => r.node.id === relatedNode.id);
        if (!existingRelation) {
          related.push({
            node: relatedNode,
            type: 'related-to',
            weight: 0.3,
          });
        }
      }
    }

    return related;
  }

  private calculateNodeSimilarity(node1: KnowledgeNode, node2: KnowledgeNode): number {
    let similarity = 0;

    const tags1 = new Set(node1.metadata.tags.map((t) => t.toLowerCase()));
    const tags2 = new Set(node2.metadata.tags.map((t) => t.toLowerCase()));
    const tagIntersection = [...tags1].filter((t) => tags2.has(t)).length;
    const tagUnion = new Set([...tags1, ...tags2]).size;
    if (tagUnion > 0) {
      similarity += (tagIntersection / tagUnion) * 0.4;
    }

    if (node1.sourcePageId && node1.sourcePageId === node2.sourcePageId) {
      similarity += 0.3;
    }

    if (node1.sourceFile && node1.sourceFile === node2.sourceFile) {
      similarity += 0.2;
    }

    const name1 = node1.name.toLowerCase();
    const name2 = node2.name.toLowerCase();
    if (name1.includes(name2) || name2.includes(name1)) {
      similarity += 0.1;
    }

    return Math.min(1, similarity);
  }

  private findSimilarNodesByEmbedding(
    node: KnowledgeNode,
    allNodes: KnowledgeNode[]
  ): Array<{ node: KnowledgeNode; similarity: number }> {
    if (!node.embedding) return [];

    const similar: Array<{ node: KnowledgeNode; similarity: number }> = [];

    for (const other of allNodes) {
      if (other.id === node.id || !other.embedding) continue;

      const similarity = this.cosineSimilarity(node.embedding, other.embedding);
      if (similarity > 0.7) {
        similar.push({ node: other, similarity });
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private buildAdjacencyList(edges: KnowledgeEdge[]): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>();

    for (const edge of edges) {
      if (!adjacencyList.has(edge.sourceId)) {
        adjacencyList.set(edge.sourceId, new Set());
      }
      if (!adjacencyList.has(edge.targetId)) {
        adjacencyList.set(edge.targetId, new Set());
      }

      adjacencyList.get(edge.sourceId)!.add(edge.targetId);
      adjacencyList.get(edge.targetId)!.add(edge.sourceId);
    }

    return adjacencyList;
  }

  private groupNodesByType(nodes: KnowledgeNode[]): Map<string, KnowledgeNode[]> {
    const groups = new Map<string, KnowledgeNode[]>();

    for (const node of nodes) {
      if (!groups.has(node.type)) {
        groups.set(node.type, []);
      }
      groups.get(node.type)!.push(node);
    }

    return groups;
  }

  private findClustersInGroup(
    nodes: KnowledgeNode[],
    adjacencyList: Map<string, Set<string>>,
    visited: Set<string>
  ): KnowledgeCluster[] {
    const clusters: KnowledgeCluster[] = [];

    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      const cluster = this.expandCluster(node.id, adjacencyList, visited, nodes);
      if (cluster.length >= 2) {
        const clusterObj = this.createClusterFromNodes(cluster, nodes, adjacencyList);
        clusters.push(clusterObj);
      }
    }

    return clusters;
  }

  private expandCluster(
    startNodeId: string,
    adjacencyList: Map<string, Set<string>>,
    visited: Set<string>,
    _allNodes: KnowledgeNode[]
  ): string[] {
    const cluster: string[] = [];
    const queue: string[] = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      cluster.push(nodeId);

      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }

    return cluster;
  }

  private clusterBySimilarity(nodes: KnowledgeNode[]): KnowledgeCluster[] {
    const clusters: KnowledgeCluster[] = [];
    const assigned = new Set<string>();

    for (const node of nodes) {
      if (assigned.has(node.id)) continue;

      const clusterNodes = [node];
      assigned.add(node.id);

      for (const other of nodes) {
        if (assigned.has(other.id)) continue;

        const similarity = this.calculateNodeSimilarity(node, other);
        if (similarity > 0.5) {
          clusterNodes.push(other);
          assigned.add(other.id);
        }
      }

      if (clusterNodes.length >= 1) {
        const cluster = this.createClusterFromNodes(
          clusterNodes.map((n) => n.id),
          nodes,
          new Map()
        );
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private detectModularityCommunities(
    nodes: KnowledgeNode[],
    _edges: KnowledgeEdge[],
    adjacencyList: Map<string, Set<string>>
  ): string[][] {
    const communities: string[][] = [];
    const nodeCommunity = new Map<string, number>();

    nodes.forEach((node, index) => {
      nodeCommunity.set(node.id, index);
      communities.push([node.id]);
    });

    let improved = true;
    const maxIterations = 10;
    let iteration = 0;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (const node of nodes) {
        const neighbors = adjacencyList.get(node.id) || new Set();
        if (neighbors.size === 0) continue;

        const bestCommunity = this.findBestCommunity(
          node.id,
          neighbors,
          nodeCommunity,
          communities
        );
        const currentCommunity = nodeCommunity.get(node.id)!;

        if (bestCommunity !== currentCommunity) {
          const nodeIndex = communities[currentCommunity].indexOf(node.id);
          if (nodeIndex > -1) {
            communities[currentCommunity].splice(nodeIndex, 1);
          }
          communities[bestCommunity].push(node.id);
          nodeCommunity.set(node.id, bestCommunity);
          improved = true;
        }
      }
    }

    return communities.filter((c) => c.length > 0);
  }

  private findBestCommunity(
    nodeId: string,
    neighbors: Set<string>,
    nodeCommunity: Map<string, number>,
    _communities: string[][]
  ): number {
    const communityScores = new Map<number, number>();

    for (const neighborId of neighbors) {
      const community = nodeCommunity.get(neighborId)!;
      const currentScore = communityScores.get(community) || 0;
      communityScores.set(community, currentScore + 1);
    }

    let bestCommunity = nodeCommunity.get(nodeId)!;
    let bestScore = communityScores.get(bestCommunity) || 0;

    for (const [community, score] of communityScores) {
      if (score > bestScore) {
        bestScore = score;
        bestCommunity = community;
      }
    }

    return bestCommunity;
  }

  private createCluster(
    nodeIds: string[],
    nodeMap: Map<string, KnowledgeNode>,
    adjacencyList: Map<string, Set<string>>
  ): KnowledgeCluster {
    const nodes = nodeIds.map((id) => nodeMap.get(id)).filter(Boolean) as KnowledgeNode[];

    const typeCount = new Map<string, number>();
    for (const node of nodes) {
      typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1);
    }

    let dominantType: string = 'concept';
    let maxCount = 0;
    for (const [type, count] of typeCount) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    const cohesion = this.calculateClusterCohesion(nodeIds, adjacencyList);

    const allTags = new Set<string>();
    for (const node of nodes) {
      for (const tag of node.metadata.tags) {
        allTags.add(tag);
      }
    }

    return {
      id: this.generateClusterId(),
      name: `${dominantType} cluster (${nodes.length} nodes)`,
      description: `Cluster of ${nodes.length} ${dominantType} nodes`,
      nodeIds,
      cohesion,
      dominantType: dominantType as KnowledgeNodeType,
      tags: [...allTags],
      createdAt: new Date(),
    };
  }

  private createClusterFromNodes(
    nodeIds: string[],
    allNodes: KnowledgeNode[],
    adjacencyList: Map<string, Set<string>>
  ): KnowledgeCluster {
    const nodeMap = new Map<string, KnowledgeNode>();
    for (const node of allNodes) {
      nodeMap.set(node.id, node);
    }
    return this.createCluster(nodeIds, nodeMap, adjacencyList);
  }

  private calculateClusterCohesion(
    nodeIds: string[],
    adjacencyList: Map<string, Set<string>>
  ): number {
    if (nodeIds.length < 2) return 1;

    let internalEdges = 0;
    const nodeIdSet = new Set(nodeIds);

    for (const nodeId of nodeIds) {
      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (nodeIdSet.has(neighbor)) {
            internalEdges++;
          }
        }
      }
    }

    const maxPossibleEdges = nodeIds.length * (nodeIds.length - 1);
    return maxPossibleEdges > 0 ? internalEdges / maxPossibleEdges : 0;
  }

  private createEdge(
    sourceId: string,
    targetId: string,
    type: KnowledgeEdgeType,
    weight: number,
    inferred: boolean
  ): KnowledgeEdge {
    const metadata: KnowledgeEdgeMetadata = {
      inferred,
      confidence: inferred ? 0.7 : 0.9,
    };

    return {
      id: this.generateEdgeId(sourceId, targetId, type),
      sourceId,
      targetId,
      type,
      weight,
      metadata,
      createdAt: new Date(),
    };
  }

  private getPairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('->');
  }

  private generateEdgeId(sourceId: string, targetId: string, type: string): string {
    const hash = crypto
      .createHash('md5')
      .update(`${sourceId}-${type}-${targetId}`)
      .digest('hex')
      .substring(0, 8);
    return `ke-${hash}`;
  }

  private generateClusterId(): string {
    const hash = crypto
      .createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
    return `kc-${hash}`;
  }
}
