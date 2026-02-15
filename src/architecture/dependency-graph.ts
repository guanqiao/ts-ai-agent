import * as path from 'path';
import { ParsedFile, SymbolKind, CodeSymbol } from '../types';
import {
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  IDependencyGraphBuilder,
} from './types';

export class DependencyGraphBuilder implements IDependencyGraphBuilder {
  build(files: ParsedFile[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: [],
      adjacencyList: new Map(),
      reverseAdjacencyList: new Map(),
    };

    for (const file of files) {
      this.addFileNodes(graph, file);
    }

    for (const file of files) {
      this.addFileEdges(graph, file, files);
    }

    this.buildAdjacencyLists(graph);

    return graph;
  }

  addNode(graph: DependencyGraph, node: DependencyNode): void {
    graph.nodes.set(node.id, node);
    if (!graph.adjacencyList.has(node.id)) {
      graph.adjacencyList.set(node.id, new Set());
    }
    if (!graph.reverseAdjacencyList.has(node.id)) {
      graph.reverseAdjacencyList.set(node.id, new Set());
    }
  }

  addEdge(graph: DependencyGraph, edge: DependencyEdge): void {
    const existingEdge = graph.edges.find(
      (e) => e.source === edge.source && e.target === edge.target && e.type === edge.type
    );

    if (existingEdge) {
      existingEdge.weight += edge.weight;
    } else {
      graph.edges.push(edge);
    }

    const adjList = graph.adjacencyList.get(edge.source);
    if (adjList) {
      adjList.add(edge.target);
    }

    const reverseAdjList = graph.reverseAdjacencyList.get(edge.target);
    if (reverseAdjList) {
      reverseAdjList.add(edge.source);
    }
  }

  findCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor);
          } else if (recursionStack.has(neighbor)) {
            const cycleStart = path.indexOf(neighbor);
            if (cycleStart !== -1) {
              cycles.push([...path.slice(cycleStart), neighbor]);
            }
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  findOrphans(graph: DependencyGraph): DependencyNode[] {
    const orphans: DependencyNode[] = [];

    for (const [nodeId, node] of graph.nodes) {
      const hasIncoming = graph.reverseAdjacencyList.get(nodeId)?.size ?? 0;
      const hasOutgoing = graph.adjacencyList.get(nodeId)?.size ?? 0;

      if (hasIncoming === 0 && hasOutgoing === 0) {
        orphans.push(node);
      }
    }

    return orphans;
  }

  findHubs(graph: DependencyGraph, threshold: number): DependencyNode[] {
    const hubs: DependencyNode[] = [];

    for (const [nodeId, node] of graph.nodes) {
      const incoming = graph.reverseAdjacencyList.get(nodeId)?.size ?? 0;
      const outgoing = graph.adjacencyList.get(nodeId)?.size ?? 0;
      const totalConnections = incoming + outgoing;

      if (totalConnections >= threshold) {
        hubs.push({ ...node, metadata: { ...node.metadata, connections: totalConnections } });
      }
    }

    return hubs.sort((a, b) => ((b.metadata?.connections as number) ?? 0) - ((a.metadata?.connections as number) ?? 0));
  }

  getDependencies(graph: DependencyGraph, nodeId: string): DependencyNode[] {
    const dependencies: DependencyNode[] = [];
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = graph.adjacencyList.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const node = graph.nodes.get(neighbor);
          if (node && !visited.has(neighbor)) {
            dependencies.push(node);
            queue.push(neighbor);
          }
        }
      }
    }

    return dependencies;
  }

  getDependents(graph: DependencyGraph, nodeId: string): DependencyNode[] {
    const dependents: DependencyNode[] = [];
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = graph.reverseAdjacencyList.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const node = graph.nodes.get(neighbor);
          if (node && !visited.has(neighbor)) {
            dependents.push(node);
            queue.push(neighbor);
          }
        }
      }
    }

    return dependents;
  }

  getShortestPath(graph: DependencyGraph, from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: from, path: [from] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === to) {
        return path;
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const neighbors = graph.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({ nodeId: neighbor, path: [...path, neighbor] });
          }
        }
      }
    }

    return null;
  }

  private addFileNodes(graph: DependencyGraph, file: ParsedFile): void {
    const moduleNode = this.createModuleNode(file);
    this.addNode(graph, moduleNode);

    for (const symbol of file.symbols) {
      const symbolNode = this.createSymbolNode(symbol, file);
      this.addNode(graph, symbolNode);

      this.addEdge(graph, {
        source: moduleNode.id,
        target: symbolNode.id,
        type: 'uses',
        weight: 1,
      });
    }
  }

  private addFileEdges(graph: DependencyGraph, file: ParsedFile, allFiles: ParsedFile[]): void {
    const moduleId = this.getModuleId(file);

    for (const imp of file.imports) {
      const targetModule = this.resolveImport(imp.source, file, allFiles);
      if (targetModule) {
        const targetModuleId = this.getModuleId(targetModule);
        this.addEdge(graph, {
          source: moduleId,
          target: targetModuleId,
          type: 'import',
          weight: 1,
        });
      }
    }

    for (const symbol of file.symbols) {
      this.addSymbolEdges(graph, symbol, file, allFiles);
    }
  }

  private addSymbolEdges(
    graph: DependencyGraph,
    symbol: CodeSymbol,
    file: ParsedFile,
    allFiles: ParsedFile[]
  ): void {
    const symbolId = `${file.path}:${symbol.name}`;

    if (symbol.extends && symbol.extends.length > 0) {
      for (const parent of symbol.extends) {
        const parentSymbol = this.findSymbol(parent, allFiles);
        if (parentSymbol) {
          this.addEdge(graph, {
            source: symbolId,
            target: `${parentSymbol.file}:${parentSymbol.symbol.name}`,
            type: 'extends',
            weight: 2,
          });
        }
      }
    }

    if (symbol.implements && symbol.implements.length > 0) {
      for (const iface of symbol.implements) {
        const ifaceSymbol = this.findSymbol(iface, allFiles);
        if (ifaceSymbol) {
          this.addEdge(graph, {
            source: symbolId,
            target: `${ifaceSymbol.file}:${ifaceSymbol.symbol.name}`,
            type: 'implements',
            weight: 2,
          });
        }
      }
    }

    if (symbol.dependencies) {
      for (const dep of symbol.dependencies) {
        if (!dep.isExternal) {
          const depSymbol = this.findSymbol(dep.name, allFiles);
          if (depSymbol) {
            this.addEdge(graph, {
              source: symbolId,
              target: `${depSymbol.file}:${depSymbol.symbol.name}`,
              type: 'uses',
              weight: 1,
            });
          }
        }
      }
    }

    if (symbol.members) {
      for (const member of symbol.members) {
        if (member.kind === SymbolKind.Method || member.kind === SymbolKind.Function) {
          const memberId = `${symbolId}.${member.name}`;
          this.addNode(graph, {
            id: memberId,
            name: member.name,
            type: 'function',
            filePath: file.path,
          });

          this.addEdge(graph, {
            source: symbolId,
            target: memberId,
            type: 'uses',
            weight: 1,
          });
        }
      }
    }
  }

  private buildAdjacencyLists(graph: DependencyGraph): void {
    for (const nodeId of graph.nodes.keys()) {
      if (!graph.adjacencyList.has(nodeId)) {
        graph.adjacencyList.set(nodeId, new Set());
      }
      if (!graph.reverseAdjacencyList.has(nodeId)) {
        graph.reverseAdjacencyList.set(nodeId, new Set());
      }
    }

    for (const edge of graph.edges) {
      graph.adjacencyList.get(edge.source)?.add(edge.target);
      graph.reverseAdjacencyList.get(edge.target)?.add(edge.source);
    }
  }

  private createModuleNode(file: ParsedFile): DependencyNode {
    return {
      id: this.getModuleId(file),
      name: path.basename(file.path, path.extname(file.path)),
      type: 'module',
      filePath: file.path,
      metadata: {
        language: file.language,
        symbolCount: file.symbols.length,
        importCount: file.imports.length,
        exportCount: file.exports.length,
      },
    };
  }

  private createSymbolNode(symbol: CodeSymbol, file: ParsedFile): DependencyNode {
    return {
      id: `${file.path}:${symbol.name}`,
      name: symbol.name,
      type: this.getSymbolNodeType(symbol.kind),
      filePath: file.path,
      metadata: {
        kind: symbol.kind,
        description: symbol.description,
      },
    };
  }

  private getModuleId(file: ParsedFile): string {
    return file.path;
  }

  private getSymbolNodeType(kind: SymbolKind): 'class' | 'function' | 'module' | 'package' {
    switch (kind) {
      case SymbolKind.Class:
      case SymbolKind.Interface:
      case SymbolKind.Enum:
        return 'class';
      case SymbolKind.Function:
      case SymbolKind.Method:
        return 'function';
      case SymbolKind.Module:
      case SymbolKind.Namespace:
        return 'module';
      default:
        return 'module';
    }
  }

  private resolveImport(
    importSource: string,
    fromFile: ParsedFile,
    allFiles: ParsedFile[]
  ): ParsedFile | null {
    if (importSource.startsWith('.')) {
      const dir = path.dirname(fromFile.path);
      const resolvedPath = path.resolve(dir, importSource);

      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.java']) {
        const fullPath = resolvedPath + ext;
        const file = allFiles.find((f) => f.path === fullPath);
        if (file) return file;
      }

      for (const file of allFiles) {
        if (file.path.startsWith(resolvedPath)) {
          return file;
        }
      }
    }

    return null;
  }

  private findSymbol(
    name: string,
    files: ParsedFile[]
  ): { file: string; symbol: CodeSymbol } | null {
    for (const file of files) {
      const symbol = file.symbols.find((s) => s.name === name);
      if (symbol) {
        return { file: file.path, symbol };
      }
    }
    return null;
  }
}
