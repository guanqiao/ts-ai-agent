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

  findRelated(nodeId: string, maxDepth: number = 2): KnowledgeNode[] {
    if (!this.graph) return [];

    const visited = new Set<string>();
    const related: KnowledgeNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const node = this.graph.nodes.get(id);
      if (node && id !== nodeId) {
        related.push(node);
      }

      if (depth < maxDepth) {
        for (const edge of this.graph.edges.values()) {
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
      node,
      order: index,
      isOptional: this.isOptionalNode(node, path!),
      estimatedTime: this.estimateNodeTime(node),
      description: this.generateNodeDescription(node, index, path!.nodes.length),
    }));

    const totalEstimatedTime = learningNodes.reduce((sum, n) => sum + (n.estimatedTime || 0), 0);

    const prerequisites = this.identifyPrerequisites(path.nodes);

    return {
      id: this.generatePathId(startNodeId, endNodeId),
      name: `Learning path: ${path.nodes[0].name} to ${path.nodes[path.nodes.length - 1].name}`,
      description: `A structured learning path covering ${path.nodes.length} concepts`,
      nodes: learningNodes,
      estimatedTime: totalEstimatedTime,
      difficulty: this.assessDifficulty(path.nodes),
      prerequisites,
      createdAt: new Date(),
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
          type: 'related',
          description: `Related to current page: ${node.name}`,
          weight: 0.5,
        });
      }
    }

    if (context.recentNodeIds && context.recentNodeIds.length > 0) {
      for (const recentId of context.recentNodeIds) {
        const related = this.findRelated(recentId, 1);
        for (const node of related) {
          this.addOrUpdateScore(scoredNodes, node, 0.3, {
            type: 'related',
            description: `Related to recently viewed: ${node.name}`,
            weight: 0.3,
          });
        }
      }
    }

    if (context.searchTerms && context.searchTerms.length > 0) {
      for (const term of context.searchTerms) {
        const matchingNodes = this.searchNodes(term);
        for (const node of matchingNodes) {
          this.addOrUpdateScore(scoredNodes, node, 0.4, {
            type: 'related',
            description: `Matches search term: ${term}`,
            weight: 0.4,
          });
        }
      }
    }

    for (const node of this.graph.nodes.values()) {
      if (node.importance > 0.7) {
        this.addOrUpdateScore(scoredNodes, node, node.importance * 0.2, {
          type: 'high-importance',
          description: `High importance node: ${node.name}`,
          weight: node.importance * 0.2,
        });
      }

      const daysSinceUpdate = (Date.now() - node.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        this.addOrUpdateScore(scoredNodes, node, 0.15, {
          type: 'recently-updated',
          description: `Recently updated: ${node.name}`,
          weight: 0.15,
        });
      }
    }

    const sortedRecommendations = Array.from(scoredNodes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, context.limit || 10);

    for (const item of sortedRecommendations) {
      const relatedNodes = this.findRelated(item.node.id, 1).slice(0, 3);
      recommendations.push({
        node: item.node,
        score: item.score,
        reason: item.reasons,
        relatedNodes,
      });
    }

    return recommendations;
  }

  private findShortestPath(startId: string, endId: string): KnowledgePath | null {
    if (!this.graph) return null;

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [startId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === endId) {
        return this.buildPathFromNodeIds(path);
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

    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (const nodeId of nodeIds) {
      const node = this.graph.nodes.get(nodeId);
      if (node) {
        nodes.push(node);
      }
    }

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const sourceId = nodeIds[i];
      const targetId = nodeIds[i + 1];

      for (const edge of this.graph.edges.values()) {
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
      startNodeId: nodeIds[0],
      endNodeId: nodeIds[nodeIds.length - 1],
      nodes,
      edges,
      length: nodes.length,
      weight,
    };
  }

  private isOptionalNode(node: KnowledgeNode, path: KnowledgePath): boolean {
    const edgeTypes = new Set<string>();

    for (const edge of path.edges) {
      if (edge.sourceId === node.id || edge.targetId === node.id) {
        edgeTypes.add(edge.type);
      }
    }

    return edgeTypes.has('related-to') && !edgeTypes.has('depends-on');
  }

  private estimateNodeTime(node: KnowledgeNode): number {
    const baseTime = 15;

    const typeMultipliers: Record<string, number> = {
      concept: 1,
      api: 2,
      pattern: 3,
      module: 4,
      class: 2,
      function: 1.5,
      interface: 1.5,
      decision: 2,
    };

    const multiplier = typeMultipliers[node.type] || 1;
    const importanceBonus = node.importance * 5;

    return Math.round(baseTime * multiplier + importanceBonus);
  }

  private generateNodeDescription(node: KnowledgeNode, index: number, total: number): string {
    const position =
      index === 0 ? 'Starting point' : index === total - 1 ? 'Final goal' : `Step ${index + 1}`;

    return `${position}: ${node.name} (${node.type})`;
  }

  private identifyPrerequisites(nodes: KnowledgeNode[]): string[] {
    const prerequisites: string[] = [];

    for (const node of nodes) {
      if (node.metadata.stability === 'stable' && node.importance > 0.5) {
        prerequisites.push(node.name);
      }
    }

    return [...new Set(prerequisites)].slice(0, 5);
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

    for (const node of this.graph.nodes.values()) {
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
