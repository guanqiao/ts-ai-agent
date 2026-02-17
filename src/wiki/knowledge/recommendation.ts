import * as crypto from 'crypto';
import {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  Recommendation,
  RecommendationContext,
  RecommendationReason,
  LearningPath,
  LearningPathNode,
  KnowledgePath,
} from './types';

export class RecommendationService {
  private graph: KnowledgeGraph | null = null;

  setGraph(graph: KnowledgeGraph): void {
    this.graph = graph;
  }

  private getNodeMap(): Map<string, KnowledgeNode> {
    const map = new Map<string, KnowledgeNode>();
    if (this.graph) {
      for (const node of this.graph.nodes) {
        map.set(node.id, node);
      }
    }
    return map;
  }

  private getEdgeList(): KnowledgeEdge[] {
    return this.graph?.edges || [];
  }

  findRelated(nodeId: string, maxDepth: number = 2): KnowledgeNode[] {
    if (!this.graph) return [];

    const nodeMap = this.getNodeMap();
    const edgeList = this.getEdgeList();
    const visited = new Set<string>();
    const related: KnowledgeNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const node = nodeMap.get(id);
      if (node && id !== nodeId) {
        related.push(node);
      }

      if (depth < maxDepth) {
        for (const edge of edgeList) {
          if (edge.sourceId === id && !visited.has(edge.targetId)) {
            queue.push({ id: edge.targetId, depth: depth + 1 });
          }
          if (edge.targetId === id && !visited.has(edge.sourceId)) {
            queue.push({ id: edge.sourceId, depth: depth + 1 });
          }
        }
      }
    }

    return related.sort((a, b) => b.importance - a.importance);
  }

  getLearningPath(startNodeId: string, endNodeId: string): LearningPath | null {
    if (!this.graph) return null;

    const path = this.findShortestPath(startNodeId, endNodeId);
    if (!path) return null;

    const learningNodes: LearningPathNode[] = path.nodes.map((node, index) => ({
      nodeId: node.id,
      position: index,
      estimatedTime: this.estimateNodeTime(node),
      prerequisites: index > 0 ? [path.nodes[index - 1].id] : [],
    }));

    const totalEstimatedTime = learningNodes.reduce((sum, n) => sum + n.estimatedTime, 0);

    return {
      id: this.generatePathId(startNodeId, endNodeId),
      name: `Learning path: ${path.nodes[0].name} to ${path.nodes[path.nodes.length - 1].name}`,
      description: `A structured learning path covering ${path.nodes.length} concepts`,
      nodeIds: path.nodes.map((n) => n.id),
      nodes: learningNodes,
      estimatedTime: totalEstimatedTime,
      difficulty: this.assessDifficulty(path.nodes),
    };
  }

  recommend(context: RecommendationContext): Recommendation[] {
    if (!this.graph) return [];

    const recommendations: Recommendation[] = [];
    const scoredNodes = new Map<
      string,
      { node: KnowledgeNode; score: number; reasons: RecommendationReason[] }
    >();

    if (context.currentPageId) {
      const related = this.findRelated(context.currentPageId, 2);
      for (const node of related) {
        this.addOrUpdateScore(scoredNodes, node, 0.5, {
          type: 'similarity',
          description: `Related to current page: ${node.name}`,
          weight: 0.5,
        });
      }
    }

    if (context.recentlyViewed && context.recentlyViewed.length > 0) {
      for (const recentId of context.recentlyViewed) {
        const related = this.findRelated(recentId, 1);
        for (const node of related) {
          this.addOrUpdateScore(scoredNodes, node, 0.3, {
            type: 'usage',
            description: `Related to recently viewed: ${node.name}`,
            weight: 0.3,
          });
        }
      }
    }

    if (context.searchQuery) {
      const matchingNodes = this.searchNodes(context.searchQuery);
      for (const node of matchingNodes) {
        this.addOrUpdateScore(scoredNodes, node, 0.4, {
          type: 'content',
          description: `Matches search query: ${context.searchQuery}`,
          weight: 0.4,
        });
      }
    }

    for (const node of this.graph.nodes) {
      if (node.importance > 0.7) {
        this.addOrUpdateScore(scoredNodes, node, node.importance * 0.2, {
          type: 'structure',
          description: `High importance node: ${node.name}`,
          weight: node.importance * 0.2,
        });
      }

      const daysSinceUpdate = (Date.now() - node.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        this.addOrUpdateScore(scoredNodes, node, 0.15, {
          type: 'usage',
          description: `Recently updated: ${node.name}`,
          weight: 0.15,
        });
      }
    }

    const sortedRecommendations = Array.from(scoredNodes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    for (const item of sortedRecommendations) {
      recommendations.push({
        id: `rec-${item.node.id}`,
        nodeId: item.node.id,
        score: item.score,
        reason: item.reasons,
        type: 'related',
      });
    }

    return recommendations;
  }

  private findShortestPath(startId: string, endId: string): KnowledgePath | null {
    if (!this.graph) return null;

    const edgeList = this.getEdgeList();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [startId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === endId) {
        return this.buildPathFromNodeIds(path);
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      for (const edge of edgeList) {
        let nextNodeId: string | null = null;

        if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
          nextNodeId = edge.targetId;
        } else if (edge.targetId === nodeId && !visited.has(edge.sourceId)) {
          nextNodeId = edge.sourceId;
        }

        if (nextNodeId) {
          queue.push({
            nodeId: nextNodeId,
            path: [...path, nextNodeId],
          });
        }
      }
    }

    return null;
  }

  private buildPathFromNodeIds(nodeIds: string[]): KnowledgePath | null {
    if (!this.graph || nodeIds.length < 2) return null;

    const nodeMap = this.getNodeMap();
    const edgeList = this.getEdgeList();
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (const nodeId of nodeIds) {
      const node = nodeMap.get(nodeId);
      if (node) {
        nodes.push(node);
      }
    }

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const sourceId = nodeIds[i];
      const targetId = nodeIds[i + 1];

      for (const edge of edgeList) {
        if (
          (edge.sourceId === sourceId && edge.targetId === targetId) ||
          (edge.sourceId === targetId && edge.targetId === sourceId)
        ) {
          edges.push(edge);
          break;
        }
      }
    }

    const weight = edges.reduce((sum, e) => sum + e.weight, 0);

    return {
      nodes,
      edges,
      length: nodes.length,
      weight,
    };
  }

  private estimateNodeTime(node: KnowledgeNode): number {
    const baseTime = 15;

    const typeMultipliers: Record<string, number> = {
      concept: 1,
      api: 2,
      pattern: 3,
      module: 4,
      component: 2,
      page: 1.5,
      decision: 2,
    };

    const multiplier = typeMultipliers[node.type] || 1;
    const importanceBonus = node.importance * 5;

    return Math.round(baseTime * multiplier + importanceBonus);
  }

  private assessDifficulty(nodes: KnowledgeNode[]): 'beginner' | 'intermediate' | 'advanced' {
    const avgImportance = nodes.reduce((sum, n) => sum + n.importance, 0) / nodes.length;
    const hasAdvancedTypes = nodes.some((n) => n.type === 'pattern' || n.type === 'decision');
    const hasDeprecated = nodes.some((n) => n.metadata.stability === 'deprecated');

    if (avgImportance > 0.7 || hasAdvancedTypes || hasDeprecated) {
      return 'advanced';
    } else if (avgImportance > 0.4) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private searchNodes(term: string): KnowledgeNode[] {
    if (!this.graph) return [];

    const lowerTerm = term.toLowerCase();
    const results: Array<{ node: KnowledgeNode; score: number }> = [];

    for (const node of this.graph.nodes) {
      let score = 0;

      if (node.name.toLowerCase().includes(lowerTerm)) {
        score += 1;
      }

      if (node.description?.toLowerCase().includes(lowerTerm)) {
        score += 0.5;
      }

      if (node.metadata.tags.some((t) => t.toLowerCase().includes(lowerTerm))) {
        score += 0.3;
      }

      if (score > 0) {
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => r.node);
  }

  private addOrUpdateScore(
    scoredNodes: Map<
      string,
      { node: KnowledgeNode; score: number; reasons: RecommendationReason[] }
    >,
    node: KnowledgeNode,
    score: number,
    reason: RecommendationReason
  ): void {
    const existing = scoredNodes.get(node.id);
    if (existing) {
      existing.score += score;
      existing.reasons.push(reason);
    } else {
      scoredNodes.set(node.id, {
        node,
        score,
        reasons: [reason],
      });
    }
  }

  private generatePathId(startId: string, endId: string): string {
    const hash = crypto
      .createHash('md5')
      .update(`${startId}-${endId}`)
      .digest('hex')
      .substring(0, 8);
    return `lp-${hash}`;
  }
}
