import * as path from 'path';
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

interface CallRelation {
  caller: string;
  callee: string;
  callerFile: string;
  calleeFile?: string;
  line?: number;
}

export class CallGraphGenerator {
  private options: GraphOptions;
  private nodeIdCounter: number = 0;

  constructor(options?: Partial<GraphOptions>) {
    this.options = { ...DEFAULT_GRAPH_OPTIONS, ...options };
  }

  async generateCallGraph(parsedFiles: ParsedFile[]): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];
    const edgeMap = new Map<string, { count: number; lines: number[] }>();
    const functionMap = new Map<string, CodeSymbol>();

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      const functions = file.symbols.filter(
        (s) => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method
      );

      for (const func of functions) {
        const nodeId = this.generateNodeId('func', file.path, func.name);
        functionMap.set(nodeId, func);

        nodes.push({
          id: nodeId,
          label: func.name,
          type: func.kind === SymbolKind.Method ? 'method' : 'function',
          module: this.getModuleName(file.path),
          path: file.path,
          line: func.location?.line,
          style: this.getNodeStyle(func.kind === SymbolKind.Method ? 'method' : 'function'),
        });
      }
    }

    for (const file of parsedFiles) {
      if (!this.shouldIncludeFile(file.path)) continue;

      const callRelations = this.extractCallRelations(file, parsedFiles);

      for (const relation of callRelations) {
        const sourceId = this.generateNodeId('func', relation.callerFile, relation.caller);
        const targetId = relation.calleeFile
          ? this.generateNodeId('func', relation.calleeFile, relation.callee)
          : this.generateNodeId('func', 'external', relation.callee);

        if (!this.options.includeExternal && !relation.calleeFile) continue;

        const edgeKey = `${sourceId}->${targetId}`;

        if (edgeMap.has(edgeKey)) {
          const existing = edgeMap.get(edgeKey)!;
          existing.count++;
          if (relation.line) existing.lines.push(relation.line);
        } else {
          edgeMap.set(edgeKey, {
            count: 1,
            lines: relation.line ? [relation.line] : [],
          });
        }
      }
    }

    for (const [edgeKey, data] of edgeMap) {
      const [source, target] = edgeKey.split('->');

      const targetExists = nodes.find((n) => n.id === target);
      if (!targetExists && this.options.includeExternal) {
        const calleeName = target.replace('func-external-', '').replace(/_/g, '.');
        nodes.push({
          id: target,
          label: calleeName,
          type: 'function',
          module: 'external',
          style: {
            ...DEFAULT_NODE_STYLE,
            borderStyle: 'dashed',
          },
        });
      }

      if (nodes.find((n) => n.id === source)) {
        edges.push({
          id: this.generateEdgeId(),
          source,
          target,
          type: 'calls',
          weight: data.count,
          label: data.count > 1 ? `${data.count}x` : undefined,
          style: this.getEdgeStyle('calls'),
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
      id: `call-graph-${Date.now()}`,
      type: 'call-graph',
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  private extractCallRelations(file: ParsedFile, allFiles: ParsedFile[]): CallRelation[] {
    const relations: CallRelation[] = [];
    const symbols = file.symbols;

    for (const symbol of symbols) {
      if (symbol.kind !== SymbolKind.Function && symbol.kind !== SymbolKind.Method) {
        continue;
      }

      const calls = this.extractCallsFromSymbol(symbol, file, allFiles);
      relations.push(...calls);
    }

    return relations;
  }

  private extractCallsFromSymbol(
    symbol: CodeSymbol,
    file: ParsedFile,
    allFiles: ParsedFile[]
  ): CallRelation[] {
    const relations: CallRelation[] = [];
    const content = symbol.signature || '';

    const callPatterns = [/(\w+)\s*\(/g, /(\w+)\.(\w+)\s*\(/g];

    for (const pattern of callPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const calleeName = match[2] || match[1];

        if (this.isBuiltinFunction(calleeName)) continue;

        const calleeFile = this.findFunctionFile(calleeName, file, allFiles);

        relations.push({
          caller: symbol.name,
          callee: calleeName,
          callerFile: file.path,
          calleeFile,
          line: symbol.location?.line,
        });
      }
    }

    return relations;
  }

  private isBuiltinFunction(name: string): boolean {
    const builtins = [
      'console',
      'log',
      'error',
      'warn',
      'info',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'parseInt',
      'parseFloat',
      'isNaN',
      'isFinite',
      'JSON',
      'parse',
      'stringify',
      'Object',
      'keys',
      'values',
      'entries',
      'assign',
      'Array',
      'from',
      'isArray',
      'map',
      'filter',
      'reduce',
      'forEach',
      'find',
      'some',
      'every',
      'String',
      'Number',
      'Boolean',
      'Promise',
      'resolve',
      'reject',
      'then',
      'catch',
      'require',
      'exports',
      'module',
    ];
    return builtins.includes(name);
  }

  private findFunctionFile(
    funcName: string,
    currentFile: ParsedFile,
    allFiles: ParsedFile[]
  ): string | undefined {
    const localFunc = currentFile.symbols.find(
      (s) => s.name === funcName && (s.kind === SymbolKind.Function || s.kind === SymbolKind.Method)
    );
    if (localFunc) return currentFile.path;

    for (const imp of currentFile.imports || []) {
      const importedSymbols = imp.specifiers || [];
      if (importedSymbols.some((s) => s === funcName)) {
        const resolvedPath = this.resolveImportPath(imp.source, currentFile.path, allFiles);
        if (resolvedPath) {
          const targetFile = allFiles.find((f) => f.path === resolvedPath);
          if (targetFile?.symbols.some((s) => s.name === funcName)) {
            return resolvedPath;
          }
        }
      }
    }

    for (const file of allFiles) {
      const exportedFunc = file.symbols.find(
        (s) =>
          s.name === funcName &&
          (s.kind === SymbolKind.Function || s.kind === SymbolKind.Method) &&
          s.modifiers?.includes('export')
      );
      if (exportedFunc) return file.path;
    }

    return undefined;
  }

  private resolveImportPath(
    importSource: string,
    fromPath: string,
    allFiles: ParsedFile[]
  ): string | null {
    if (importSource.startsWith('.')) {
      const dir = path.dirname(fromPath);
      const resolved = path.resolve(dir, importSource);

      const extensions = ['.ts', '.tsx', '.js', '.jsx'];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (allFiles.find((f) => f.path === withExt)) {
          return withExt;
        }
      }
    }
    return null;
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

  private highlightCycles(edges: GraphEdge[], cycles: string[][]): void {
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.length - 1; i++) {
        const source = cycle[i];
        const target = cycle[i + 1];

        const edge = edges.find((e) => e.source === source && e.target === target);
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
