import { ParsedFile, SymbolKind, CodeSymbol } from '../../types';
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

interface InheritanceRelation {
  child: string;
  parent: string;
  childFile: string;
  parentFile?: string;
  type: 'extends' | 'implements';
}

export class InheritanceGraphGenerator {
  private options: GraphOptions;
  private nodeIdCounter: number = 0;

  constructor(options?: Partial<GraphOptions>) {
    this.options = { ...DEFAULT_GRAPH_OPTIONS, ...options };
  }

  async generateInheritanceGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];
    const classMap = new Map<string, CodeSymbol>();
    const interfaceMap = new Map<string, CodeSymbol>();

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      for (const symbol of file.symbols) {
        if (symbol.kind === SymbolKind.Class) {
          const nodeId = this.generateNodeId('class', file.path, symbol.name);
          classMap.set(nodeId, symbol);

          nodes.push({
            id: nodeId,
            label: symbol.name,
            type: 'class',
            module: this.getModuleName(file.path),
            path: file.path,
            line: symbol.location?.line,
            style: this.getNodeStyle('class'),
          });
        } else if (symbol.kind === SymbolKind.Interface) {
          const nodeId = this.generateNodeId('interface', file.path, symbol.name);
          interfaceMap.set(nodeId, symbol);

          nodes.push({
            id: nodeId,
            label: symbol.name,
            type: 'interface',
            module: this.getModuleName(file.path),
            path: file.path,
            line: symbol.location?.line,
            style: this.getNodeStyle('interface'),
          });
        }
      }
    }

    const relations = this.extractInheritanceRelations(parsedFiles);

    for (const relation of relations) {
      const childId = this.generateNodeId(
        relation.type === 'implements' ? 'class' : 'class',
        relation.childFile,
        relation.child
      );

      const parentId = relation.parentFile
        ? this.generateNodeId(
            relation.type === 'implements' ? 'interface' : 'class',
            relation.parentFile,
            relation.parent
          )
        : this.generateNodeId('external', 'external', relation.parent);

      if (!nodes.find((n) => n.id === parentId)) {
        const parentType = relation.type === 'implements' ? 'interface' : 'class';
        nodes.push({
          id: parentId,
          label: relation.parent,
          type: parentType,
          module: 'external',
          style: {
            ...this.getNodeStyle(parentType),
            borderStyle: 'dashed',
          },
        });
      }

      edges.push({
        id: this.generateEdgeId(),
        source: childId,
        target: parentId,
        type: relation.type,
        weight: 1,
        style: this.getEdgeStyle(relation.type),
      });
    }

    const moduleClusters = this.createModuleClusters(nodes);
    clusters.push(...moduleClusters);

    const cycles = this.detectCycles(nodes, edges);
    const metadata = this.createMetadata(nodes, edges, cycles, parsedFiles.length);

    return {
      id: `inheritance-graph-${Date.now()}`,
      type: 'inheritance',
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  async generateImplementationGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];

    const interfaces = new Map<string, { symbol: CodeSymbol; file: string }>();
    const implementations = new Map<string, { symbol: CodeSymbol; file: string }[]>();

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      for (const symbol of file.symbols) {
        if (symbol.kind === SymbolKind.Interface) {
          const nodeId = this.generateNodeId('interface', file.path, symbol.name);
          interfaces.set(symbol.name, { symbol, file: file.path });

          nodes.push({
            id: nodeId,
            label: symbol.name,
            type: 'interface',
            module: this.getModuleName(file.path),
            path: file.path,
            style: this.getNodeStyle('interface'),
          });
        }
      }
    }

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      for (const symbol of file.symbols) {
        if (symbol.kind === SymbolKind.Class && symbol.extends) {
          const implInterfaces = Array.isArray(symbol.extends) ? symbol.extends : [symbol.extends];

          for (const impl of implInterfaces) {
            const interfaceInfo = interfaces.get(impl);
            if (interfaceInfo) {
              const classId = this.generateNodeId('class', file.path, symbol.name);
              const interfaceId = this.generateNodeId('interface', interfaceInfo.file, impl);

              if (!nodes.find((n) => n.id === classId)) {
                nodes.push({
                  id: classId,
                  label: symbol.name,
                  type: 'class',
                  module: this.getModuleName(file.path),
                  path: file.path,
                  style: this.getNodeStyle('class'),
                });
              }

              edges.push({
                id: this.generateEdgeId(),
                source: classId,
                target: interfaceId,
                type: 'implements',
                weight: 1,
                style: this.getEdgeStyle('implements'),
              });

              if (!implementations.has(impl)) {
                implementations.set(impl, []);
              }
              implementations.get(impl)!.push({ symbol, file: file.path });
            }
          }
        }
      }
    }

    for (const [interfaceName, impls] of implementations) {
      if (impls.length > 1) {
        const clusterId = `cluster-impl-${interfaceName}`;
        const interfaceInfo = interfaces.get(interfaceName);
        const nodeIds = [
          this.generateNodeId('interface', interfaceInfo!.file, interfaceName),
          ...impls.map((impl) => this.generateNodeId('class', impl.file, impl.symbol.name)),
        ];

        clusters.push({
          id: clusterId,
          label: `${interfaceName} implementations`,
          nodeIds,
          style: {
            fillColor: '#F0F8FF',
            borderColor: '#4169E1',
            borderStyle: 'dashed',
          },
        });
      }
    }

    const cycles = this.detectCycles(nodes, edges);
    const metadata = this.createMetadata(nodes, edges, cycles, parsedFiles.length);

    return {
      id: `implementation-graph-${Date.now()}`,
      type: 'implementation',
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  private extractInheritanceRelations(parsedFiles: ParsedFile[]): InheritanceRelation[] {
    const relations: InheritanceRelation[] = [];

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      for (const symbol of file.symbols) {
        if (symbol.kind === SymbolKind.Class) {
          if (symbol.extends) {
            const extendsList = Array.isArray(symbol.extends) ? symbol.extends : [symbol.extends];

            for (const parent of extendsList) {
              const parentFile = this.findSymbolFile(parent, parsedFiles);
              const isInterface = this.isInterface(parent, parsedFiles);

              relations.push({
                child: symbol.name,
                parent,
                childFile: file.path,
                parentFile,
                type: isInterface ? 'implements' : 'extends',
              });
            }
          }
        }
      }
    }

    return relations;
  }

  private findSymbolFile(symbolName: string, allFiles: ParsedFile[]): string | undefined {
    for (const file of allFiles) {
      const found = file.symbols.find((s) => s.name === symbolName);
      if (found) return file.path;
    }
    return undefined;
  }

  private isInterface(symbolName: string, allFiles: ParsedFile[]): boolean {
    for (const file of allFiles) {
      const found = file.symbols.find(
        (s) => s.name === symbolName && s.kind === SymbolKind.Interface
      );
      if (found) return true;
    }
    return false;
  }

  private shouldIncludeFile(filePath: string): boolean {
    for (const pattern of this.options.excludePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return false;
      }
    }
    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.')
    );
    return regex.test(value);
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

  private createModuleClusters(nodes: GraphNode[]): GraphCluster[] {
    const moduleGroups = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.module && node.module !== 'external') {
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
    // Inheritance graphs shouldn't have cycles in well-designed systems
    // But we check anyway
    const adjacencyList = new Map<string, string[]>();
    const nodeIds = new Set(nodes.map((n) => n.id));

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
    return {
      generatedAt: new Date(),
      sourceFiles,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      hasCycles: cycles.length > 0,
      cycles,
      maxDepth: this.calculateMaxDepth(nodes, edges),
    };
  }

  private calculateMaxDepth(nodes: GraphNode[], edges: GraphEdge[]): number {
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

    let maxDepth = 0;
    for (const node of nodes) {
      maxDepth = Math.max(maxDepth, calcDepth(node.id, new Set()));
    }
    return maxDepth;
  }

  private generateNodeId(type: string, filePath: string, name: string): string {
    const safePath = filePath.replace(/[^a-zA-Z0-9]/g, '_');
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${type}-${safePath}-${safeName}`;
  }

  private generateEdgeId(): string {
    return `edge-${++this.nodeIdCounter}`;
  }
}
