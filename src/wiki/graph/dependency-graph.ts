import * as path from 'path';
import { ParsedFile } from '../../types';
import { ArchitectureReport } from '../../architecture/types';
import {
  Graph,
  GraphNode,
  GraphEdge,
  GraphCluster,
  GraphMetadata,
  NodeType,
  EdgeType,
  NodeStyle,
  EdgeStyle,
  GraphOptions,
  DEFAULT_GRAPH_OPTIONS,
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
} from './types';

export class DependencyGraphGenerator {
  private options: GraphOptions;
  private nodeIdCounter: number = 0;

  constructor(options?: Partial<GraphOptions>) {
    this.options = { ...DEFAULT_GRAPH_OPTIONS, ...options };
  }

  async generateModuleDependencyGraph(
    parsedFiles: ParsedFile[],
    architecture?: ArchitectureReport
  ): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];
    const edgeMap = new Map<string, number>();

    const moduleMap = this.groupFilesByModule(parsedFiles);

    for (const [moduleName, files] of moduleMap) {
      const nodeId = this.generateNodeId('module', moduleName);
      
      nodes.push({
        id: nodeId,
        label: moduleName,
        type: 'module',
        module: moduleName,
        style: this.getNodeStyle('module'),
      });

      const dependencies = this.extractModuleDependencies(files, parsedFiles);
      
      for (const dep of dependencies) {
        if (dep === moduleName) continue;
        if (!this.shouldIncludeModule(dep)) continue;

        const targetId = this.generateNodeId('module', dep);
        const edgeKey = `${nodeId}->${targetId}`;

        if (edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, edgeMap.get(edgeKey)! + 1);
        } else {
          edgeMap.set(edgeKey, 1);
        }
      }
    }

    for (const [edgeKey, weight] of edgeMap) {
      const [source, target] = edgeKey.split('->');
      if (nodes.find(n => n.id === target)) {
        edges.push({
          id: this.generateEdgeId(),
          source,
          target,
          type: 'depends-on',
          weight,
          style: this.getEdgeStyle('depends-on'),
        });
      }
    }

    if (architecture && this.options.groupByLayer) {
      const layerClusters = this.createLayerClusters(architecture, nodes);
      clusters.push(...layerClusters);
    }

    const cycles = this.detectCycles(nodes, edges);
    const metadata = this.createMetadata(nodes, edges, cycles, parsedFiles.length);

    if (this.options.highlightCycles && cycles.length > 0) {
      this.highlightCycles(edges, cycles);
    }

    return {
      id: `dep-graph-${Date.now()}`,
      type: 'dependency',
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  async generateFileDependencyGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];
    const edgeMap = new Map<string, { count: number; types: Set<string> }>();

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      const nodeId = this.generateNodeId('file', file.path);
      const moduleName = this.getModuleName(file.path);

      nodes.push({
        id: nodeId,
        label: path.basename(file.path),
        type: 'file',
        module: moduleName,
        path: file.path,
        style: this.getNodeStyle('file'),
      });

      for (const imp of file.imports || []) {
        const resolvedPath = this.resolveImportPath(imp.source, file.path, parsedFiles);
        if (!resolvedPath || !this.shouldIncludeFile(resolvedPath)) continue;

        const targetId = this.generateNodeId('file', resolvedPath);
        const edgeKey = `${nodeId}->${targetId}`;

        if (edgeMap.has(edgeKey)) {
          const existing = edgeMap.get(edgeKey)!;
          existing.count++;
          existing.types.add('imports');
        } else {
          edgeMap.set(edgeKey, { count: 1, types: new Set(['imports']) });
        }
      }
    }

    for (const [edgeKey, data] of edgeMap) {
      const [source, target] = edgeKey.split('->');
      if (nodes.find(n => n.id === target)) {
        edges.push({
          id: this.generateEdgeId(),
          source,
          target,
          type: 'imports',
          weight: data.count,
          style: this.getEdgeStyle('imports'),
        });
      }
    }

    const moduleClusters = this.createModuleClusters(nodes);
    clusters.push(...moduleClusters);

    const cycles = this.detectCycles(nodes, edges);
    const metadata = this.createMetadata(nodes, edges, cycles, parsedFiles.length);

    if (this.options.highlightCycles && cycles.length > 0) {
      this.highlightCycles(edges, cycles);
    }

    return {
      id: `file-dep-graph-${Date.now()}`,
      type: 'dependency',
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  detectCircularDependencies(graph: Graph): string[][] {
    return this.detectCycles(graph.nodes, graph.edges);
  }

  private groupFilesByModule(parsedFiles: ParsedFile[]): Map<string, ParsedFile[]> {
    const moduleMap = new Map<string, ParsedFile[]>();

    for (const file of parsedFiles) {
      const moduleName = this.getModuleName(file.path);
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }
      moduleMap.get(moduleName)!.push(file);
    }

    return moduleMap;
  }

  private getModuleName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    if (parts.length <= 1) return 'root';
    
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0 && srcIndex < parts.length - 2) {
      return parts.slice(srcIndex + 1, srcIndex + 2)[0];
    }
    
    return parts[parts.length - 2] || 'root';
  }

  private extractModuleDependencies(
    files: ParsedFile[],
    allFiles: ParsedFile[]
  ): string[] {
    const dependencies = new Set<string>();

    for (const file of files) {
      for (const imp of file.imports || []) {
        const resolvedPath = this.resolveImportPath(imp.source, file.path, allFiles);
        if (resolvedPath) {
          const depModule = this.getModuleName(resolvedPath);
          dependencies.add(depModule);
        }
      }
    }

    return Array.from(dependencies);
  }

  private resolveImportPath(
    importSource: string,
    fromPath: string,
    allFiles: ParsedFile[]
  ): string | null {
    if (importSource.startsWith('.')) {
      const dir = path.dirname(fromPath);
      const resolved = path.resolve(dir, importSource);
      
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (allFiles.find(f => f.path === withExt)) {
          return withExt;
        }
      }
      
      return null;
    }

    if (!this.options.includeExternal) {
      return null;
    }

    const matching = allFiles.find(f => f.path.includes(importSource));
    return matching?.path || null;
  }

  private shouldIncludeFile(filePath: string): boolean {
    for (const pattern of this.options.excludePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return false;
      }
    }
    return true;
  }

  private shouldIncludeModule(moduleName: string): boolean {
    for (const pattern of this.options.excludePatterns) {
      if (this.matchesPattern(moduleName, pattern)) {
        return false;
      }
    }
    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
    );
    return regex.test(value);
  }

  private createLayerClusters(
    architecture: ArchitectureReport,
    nodes: GraphNode[]
  ): GraphCluster[] {
    const clusters: GraphCluster[] = [];

    for (const layer of architecture.layers || []) {
      const layerNodeIds = nodes
        .filter(n => n.module && layer.modules?.some((m) => m.name === n.module))
        .map(n => n.id);

      if (layerNodeIds.length > 0) {
        clusters.push({
          id: `cluster-layer-${layer.name}`,
          label: layer.name,
          nodeIds: layerNodeIds,
          style: {
            fillColor: this.getLayerColor(layer.name),
            borderColor: '#666666',
            borderStyle: 'dashed',
          },
        });
      }
    }

    return clusters;
  }

  private createModuleClusters(nodes: GraphNode[]): GraphCluster[] {
    const moduleGroups = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.module) {
        if (!moduleGroups.has(node.module)) {
          moduleGroups.set(node.module, []);
        }
        moduleGroups.get(node.module)!.push(node.id);
      }
    }

    const clusters: GraphCluster[] = [];
    for (const [moduleName, nodeIds] of moduleGroups) {
      clusters.push({
        id: `cluster-module-${moduleName}`,
        label: moduleName,
        nodeIds,
        style: {
          fillColor: this.getModuleColor(moduleName),
          borderColor: '#999999',
          borderStyle: 'solid',
        },
      });
    }

    return clusters;
  }

  private detectCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
    const adjacencyList = new Map<string, string[]>();
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const node of nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const edge of edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            const cycle = path.slice(cycleStart);
            if (cycle.length > 1) {
              cycles.push([...cycle, neighbor]);
            }
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  private highlightCycles(edges: GraphEdge[], cycles: string[][]): void {
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.length - 1; i++) {
        const source = cycle[i];
        const target = cycle[i + 1];
        
        const edge = edges.find(e => e.source === source && e.target === target);
        if (edge && edge.style) {
          edge.style.color = this.options.theme.highlightColor;
          edge.style.width = 2;
        }
      }
    }
  }

  private getNodeStyle(type: NodeType): NodeStyle {
    const color = this.options.theme.nodeColors[type] || '#FFFFFF';
    return {
      ...DEFAULT_NODE_STYLE,
      fillColor: color,
    };
  }

  private getEdgeStyle(type: EdgeType): EdgeStyle {
    const color = this.options.theme.edgeColors[type] || '#666666';
    return {
      ...DEFAULT_EDGE_STYLE,
      color,
    };
  }

  private getLayerColor(layerName: string): string {
    const colors: Record<string, string> = {
      'presentation': '#E3F2FD',
      'application': '#E8F5E9',
      'domain': '#FFF3E0',
      'infrastructure': '#F3E5F5',
      'data': '#ECEFF1',
    };
    return colors[layerName.toLowerCase()] || '#F5F5F5';
  }

  private getModuleColor(moduleName: string): string {
    const hash = moduleName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 95%)`;
  }

  private createMetadata(
    nodes: GraphNode[],
    edges: GraphEdge[],
    cycles: string[][],
    sourceFiles: number
  ): GraphMetadata {
    let maxDepth = 0;
    
    const adjacencyList = new Map<string, string[]>();
    for (const node of nodes) {
      adjacencyList.set(node.id, []);
    }
    for (const edge of edges) {
      adjacencyList.get(edge.source)?.push(edge.target);
    }

    const depthMap = new Map<string, number>();
    const calcDepth = (nodeId: string, visited: Set<string>): number => {
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
      if (visited.has(nodeId)) return 0;
      
      visited.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];
      let depth = 0;
      
      for (const neighbor of neighbors) {
        depth = Math.max(depth, calcDepth(neighbor, visited) + 1);
      }
      
      visited.delete(nodeId);
      depthMap.set(nodeId, depth);
      return depth;
    };

    for (const node of nodes) {
      maxDepth = Math.max(maxDepth, calcDepth(node.id, new Set()));
    }

    return {
      generatedAt: new Date(),
      sourceFiles,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      hasCycles: cycles.length > 0,
      cycles,
      maxDepth,
    };
  }

  private generateNodeId(type: string, identifier: string): string {
    return `${type}-${identifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private generateEdgeId(): string {
    return `edge-${++this.nodeIdCounter}`;
  }
}
