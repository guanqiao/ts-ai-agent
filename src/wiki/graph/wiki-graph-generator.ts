import { ParsedFile } from '../../types';
import { ArchitectureReport } from '../../architecture/types';
import {
  IWikiGraphGenerator,
  Graph,
  GraphNode,
  GraphEdge,
  GraphCluster,
  GraphOptions,
  GraphFilter,
  GraphFormat,
  DEFAULT_GRAPH_OPTIONS,
} from './types';
import { DependencyGraphGenerator } from './dependency-graph';
import { CallGraphGenerator } from './call-graph';
import { InheritanceGraphGenerator } from './inheritance-graph';

export class WikiGraphGenerator implements IWikiGraphGenerator {
  private dependencyGenerator: DependencyGraphGenerator;
  private callGraphGenerator: CallGraphGenerator;
  private inheritanceGenerator: InheritanceGraphGenerator;
  private options: GraphOptions;

  constructor(options?: Partial<GraphOptions>) {
    this.options = { ...DEFAULT_GRAPH_OPTIONS, ...options };
    this.dependencyGenerator = new DependencyGraphGenerator(this.options);
    this.callGraphGenerator = new CallGraphGenerator(this.options);
    this.inheritanceGenerator = new InheritanceGraphGenerator(this.options);
  }

  async generateDependencyGraph(
    parsedFiles: ParsedFile[],
    architecture?: ArchitectureReport
  ): Promise<Graph> {
    return this.dependencyGenerator.generateModuleDependencyGraph(parsedFiles, architecture);
  }

  async generateCallGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    return this.callGraphGenerator.generateCallGraph(parsedFiles);
  }

  async generateInheritanceGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    return this.inheritanceGenerator.generateInheritanceGraph(parsedFiles);
  }

  async generateImplementationGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    return this.inheritanceGenerator.generateImplementationGraph(parsedFiles);
  }

  exportToMermaid(graph: Graph, options?: Partial<GraphOptions>): string {
    const opts = { ...this.options, ...options };
    const lines: string[] = [];

    const direction = opts.direction || 'TB';
    lines.push(`graph ${direction}`);

    for (const cluster of graph.clusters) {
      lines.push(`  subgraph ${cluster.id} ["${cluster.label}"]`);
      if (cluster.style?.fillColor) {
        lines.push(`    style ${cluster.id} fill:${cluster.style.fillColor}`);
      }
      for (const nodeId of cluster.nodeIds) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (node) {
          lines.push(`    ${this.formatMermaidNode(node)}`);
        }
      }
      lines.push('  end');
    }

    for (const node of graph.nodes) {
      const inCluster = graph.clusters.some((c) => c.nodeIds.includes(node.id));
      if (!inCluster) {
        lines.push(`  ${this.formatMermaidNode(node)}`);
      }
    }

    for (const edge of graph.edges) {
      const edgeStr = this.formatMermaidEdge(edge);
      lines.push(`  ${edgeStr}`);
    }

    if (graph.metadata.hasCycles && opts.highlightCycles) {
      lines.push('');
      lines.push('  %% Cyclic dependencies detected:');
      for (const cycle of graph.metadata.cycles) {
        lines.push(`  %% ${cycle.join(' -> ')}`);
      }
    }

    return lines.join('\n');
  }

  exportToSVG(graph: Graph, options?: Partial<GraphOptions>): string {
    const opts = { ...this.options, ...options };
    const width = 800;
    const height = 600;
    const padding = 50;
    const nodeWidth = 120;
    const nodeHeight = 40;

    const nodePositions = this.calculateNodePositions(
      graph.nodes,
      graph.clusters,
      width - padding * 2,
      height - padding * 2
    );

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .node { fill: #fff; stroke: #333; stroke-width: 1; }
    .node-label { font-family: ${opts.theme.fontFamily}; font-size: ${opts.theme.fontSize}px; }
    .edge { stroke: #666; stroke-width: 1; fill: none; }
    .edge-label { font-family: ${opts.theme.fontFamily}; font-size: 10px; fill: #666; }
    .cluster { fill: #f5f5f5; stroke: #999; stroke-width: 1; stroke-dasharray: 5,5; }
    .cluster-label { font-family: ${opts.theme.fontFamily}; font-size: 12px; font-weight: bold; }
  </style>
  <rect width="100%" height="100%" fill="${opts.theme.backgroundColor}"/>
`;

    for (const cluster of graph.clusters) {
      const clusterNodes = cluster.nodeIds.map((id) => nodePositions.get(id)).filter(Boolean) as {
        x: number;
        y: number;
      }[];
      if (clusterNodes.length === 0) continue;

      const minX = Math.min(...clusterNodes.map((p) => p.x)) - 20;
      const minY = Math.min(...clusterNodes.map((p) => p.y)) - 30;
      const maxX = Math.max(...clusterNodes.map((p) => p.x + nodeWidth)) + 20;
      const maxY = Math.max(...clusterNodes.map((p) => p.y + nodeHeight)) + 20;

      svg += `  <rect class="cluster" x="${minX + padding}" y="${minY + padding}" width="${maxX - minX}" height="${maxY - minY}" rx="5"/>
  <text class="cluster-label" x="${minX + padding + 10}" y="${minY + padding + 20}">${this.escapeXml(cluster.label)}</text>
`;
    }

    for (const edge of graph.edges) {
      const source = nodePositions.get(edge.source);
      const target = nodePositions.get(edge.target);
      if (!source || !target) continue;

      const x1 = source.x + nodeWidth / 2 + padding;
      const y1 = source.y + nodeHeight + padding;
      const x2 = target.x + nodeWidth / 2 + padding;
      const y2 = target.y + padding;

      const color = edge.style?.color || opts.theme.edgeColors[edge.type] || '#666';
      svg += `  <path class="edge" style="stroke:${color}" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#arrow)"/>
`;
    }

    svg += `  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#666"/>
    </marker>
  </defs>
`;

    for (const node of graph.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      const color = node.style?.fillColor || opts.theme.nodeColors[node.type] || '#fff';
      const x = pos.x + padding;
      const y = pos.y + padding;

      svg += `  <rect class="node" style="fill:${color}" x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="5"/>
  <text class="node-label" x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 4}" text-anchor="middle">${this.escapeXml(node.label)}</text>
`;
    }

    svg += '</svg>';
    return svg;
  }

  exportToJSON(graph: Graph): string {
    return JSON.stringify(graph, null, 2);
  }

  exportToDot(graph: Graph, options?: Partial<GraphOptions>): string {
    const opts = { ...this.options, ...options };
    const lines: string[] = [];

    const rankdir =
      opts.direction === 'LR'
        ? 'LR'
        : opts.direction === 'BT'
          ? 'BT'
          : opts.direction === 'RL'
            ? 'RL'
            : 'TB';

    lines.push('digraph G {');
    lines.push(`  rankdir=${rankdir};`);
    lines.push(`  node [shape=box, style="rounded,filled"];`);
    lines.push('');

    for (const cluster of graph.clusters) {
      lines.push(`  subgraph cluster_${cluster.id} {`);
      lines.push(`    label="${cluster.label}";`);
      if (cluster.style?.fillColor) {
        lines.push(`    style=filled;`);
        lines.push(`    fillcolor="${cluster.style.fillColor}";`);
      }
      for (const nodeId of cluster.nodeIds) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (node) {
          const color = node.style?.fillColor || opts.theme.nodeColors[node.type] || '#fff';
          lines.push(`    "${node.id}" [label="${node.label}", fillcolor="${color}"];`);
        }
      }
      lines.push('  }');
    }

    for (const node of graph.nodes) {
      const inCluster = graph.clusters.some((c) => c.nodeIds.includes(node.id));
      if (!inCluster) {
        const color = node.style?.fillColor || opts.theme.nodeColors[node.type] || '#fff';
        lines.push(`  "${node.id}" [label="${node.label}", fillcolor="${color}"];`);
      }
    }

    lines.push('');
    for (const edge of graph.edges) {
      const attrs: string[] = [];
      if (edge.label) {
        attrs.push(`label="${edge.label}"`);
      }
      if (edge.style?.color) {
        attrs.push(`color="${edge.style.color}"`);
      }
      const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
      lines.push(`  "${edge.source}" -> "${edge.target}"${attrStr};`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  detectCycles(graph: Graph): string[][] {
    return graph.metadata.cycles;
  }

  filterGraph(graph: Graph, filter: GraphFilter): Graph {
    let filteredNodes = [...graph.nodes];
    let filteredEdges = [...graph.edges];

    if (filter.nodeTypes && filter.nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter((n) => filter.nodeTypes!.includes(n.type));
    }

    if (filter.modules && filter.modules.length > 0) {
      filteredNodes = filteredNodes.filter((n) => !n.module || filter.modules!.includes(n.module));
    }

    if (filter.excludePatterns && filter.excludePatterns.length > 0) {
      filteredNodes = filteredNodes.filter((n) => {
        if (!n.path) return true;
        return !filter.excludePatterns!.some((pattern) =>
          new RegExp(pattern.replace(/\*/g, '.*')).test(n.path!)
        );
      });
    }

    if (filter.maxNodes && filteredNodes.length > filter.maxNodes) {
      filteredNodes = filteredNodes.slice(0, filter.maxNodes);
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = filteredEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (filter.minWeight !== undefined) {
      filteredEdges = filteredEdges.filter((e) => e.weight >= filter.minWeight!);
    }

    if (filter.edgeTypes && filter.edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter((e) => filter.edgeTypes!.includes(e.type));
    }

    const filteredClusters = graph.clusters
      .map((c) => ({
        ...c,
        nodeIds: c.nodeIds.filter((id) => nodeIds.has(id)),
      }))
      .filter((c) => c.nodeIds.length > 0);

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
      clusters: filteredClusters,
      metadata: {
        ...graph.metadata,
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length,
      },
    };
  }

  export(graph: Graph, format: GraphFormat, options?: Partial<GraphOptions>): string {
    switch (format) {
      case 'mermaid':
        return this.exportToMermaid(graph, options);
      case 'svg':
        return this.exportToSVG(graph, options);
      case 'json':
        return this.exportToJSON(graph);
      case 'dot':
        return this.exportToDot(graph, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private formatMermaidNode(node: GraphNode): string {
    const shape = node.style?.shape || 'box';
    let nodeStr: string;

    switch (shape) {
      case 'ellipse':
      case 'circle':
        nodeStr = `${node.id}(("${node.label}"))`;
        break;
      case 'diamond':
        nodeStr = `${node.id}{${node.label}}`;
        break;
      case 'hexagon':
        nodeStr = `${node.id}{{${node.label}}}`;
        break;
      default:
        nodeStr = `${node.id}["${node.label}"]`;
    }

    if (node.style?.fillColor) {
      nodeStr += `:::${node.type}`;
    }

    return nodeStr;
  }

  private formatMermaidEdge(edge: GraphEdge): string {
    const arrow = edge.style?.arrowHead === 'none' ? '---' : '-->';
    let edgeStr = `${edge.source} ${arrow} ${edge.target}`;

    if (edge.label) {
      edgeStr += `|${edge.label}|`;
    }

    return edgeStr;
  }

  private calculateNodePositions(
    nodes: GraphNode[],
    _clusters: GraphCluster[],
    _width: number,
    _height: number
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const nodeWidth = 120;
    const nodeHeight = 40;
    const horizontalGap = 50;
    const verticalGap = 60;

    const columns = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / columns);

    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (index >= nodes.length) break;

        const x = col * (nodeWidth + horizontalGap);
        const y = row * (nodeHeight + verticalGap);

        positions.set(nodes[index].id, { x, y });
        index++;
      }
    }

    return positions;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
