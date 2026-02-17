import * as crypto from 'crypto';
import { ParsedFile, CodeSymbol, SymbolKind } from '../../types';

export interface SymbolSnapshot {
  id: string;
  name: string;
  kind: SymbolKind;
  signature: string;
  description: string;
  hash: string;
  filePath: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  dependents: string[];
  exported: boolean;
  imported: boolean;
}

export interface SymbolChange {
  symbolId: string;
  symbolName: string;
  symbolKind: SymbolKind;
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  oldSnapshot?: SymbolSnapshot;
  newSnapshot?: SymbolSnapshot;
  impactLevel: 'high' | 'medium' | 'low';
}

export interface SymbolDependencyGraph {
  nodes: Map<string, SymbolSnapshot>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

export class IncrementalSymbolTracker {
  private symbolMap: Map<string, SymbolSnapshot> = new Map();
  private fileSymbolMap: Map<string, Set<string>> = new Map();
  private dependencyGraph: SymbolDependencyGraph = {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };

  buildFromFiles(files: ParsedFile[]): void {
    this.clear();

    for (const file of files) {
      this.processFile(file);
    }

    this.buildDependencyGraph();
  }

  getSymbol(symbolId: string): SymbolSnapshot | undefined {
    return this.symbolMap.get(symbolId);
  }

  getSymbolsByFile(filePath: string): SymbolSnapshot[] {
    const symbolIds = this.fileSymbolMap.get(filePath);
    if (!symbolIds) {
      return [];
    }

    return Array.from(symbolIds)
      .map(id => this.symbolMap.get(id))
      .filter((s): s is SymbolSnapshot => s !== undefined);
  }

  getSymbolDependencies(symbolId: string): SymbolSnapshot[] {
    const deps = this.dependencyGraph.edges.get(symbolId);
    if (!deps) {
      return [];
    }

    return Array.from(deps)
      .map(id => this.symbolMap.get(id))
      .filter((s): s is SymbolSnapshot => s !== undefined);
  }

  getSymbolDependents(symbolId: string): SymbolSnapshot[] {
    const dependents = this.dependencyGraph.reverseEdges.get(symbolId);
    if (!dependents) {
      return [];
    }

    return Array.from(dependents)
      .map(id => this.symbolMap.get(id))
      .filter((s): s is SymbolSnapshot => s !== undefined);
  }

  detectChanges(oldTracker: IncrementalSymbolTracker): SymbolChange[] {
    const changes: SymbolChange[] = [];
    const processedIds = new Set<string>();

    for (const [symbolId, oldSnapshot] of oldTracker.symbolMap) {
      processedIds.add(symbolId);
      const newSnapshot = this.symbolMap.get(symbolId);

      if (!newSnapshot) {
        changes.push({
          symbolId,
          symbolName: oldSnapshot.name,
          symbolKind: oldSnapshot.kind,
          filePath: oldSnapshot.filePath,
          changeType: 'deleted',
          oldSnapshot,
          impactLevel: this.assessImpact(oldSnapshot, 'deleted'),
        });
      } else if (oldSnapshot.hash !== newSnapshot.hash) {
        changes.push({
          symbolId,
          symbolName: newSnapshot.name,
          symbolKind: newSnapshot.kind,
          filePath: newSnapshot.filePath,
          changeType: 'modified',
          oldSnapshot,
          newSnapshot,
          impactLevel: this.assessImpact(newSnapshot, 'modified'),
        });
      }
    }

    for (const [symbolId, newSnapshot] of this.symbolMap) {
      if (!processedIds.has(symbolId)) {
        changes.push({
          symbolId,
          symbolName: newSnapshot.name,
          symbolKind: newSnapshot.kind,
          filePath: newSnapshot.filePath,
          changeType: 'added',
          newSnapshot,
          impactLevel: this.assessImpact(newSnapshot, 'added'),
        });
      }
    }

    return this.prioritizeChanges(changes);
  }

  getAffectedSymbols(symbolId: string, depth: number = 2): Set<string> {
    const affected = new Set<string>();
    this.collectAffectedSymbols(symbolId, affected, depth);
    return affected;
  }

  getSymbolPageMapping(): Map<string, string[]> {
    const mapping = new Map<string, string[]>();

    for (const [symbolId, snapshot] of this.symbolMap) {
      const pageIds: string[] = [];

      const moduleName = this.extractModuleName(snapshot.filePath);
      pageIds.push(`module-${moduleName}`);

      if (snapshot.exported) {
        pageIds.push('api-reference');
      }

      mapping.set(symbolId, pageIds);
    }

    return mapping;
  }

  exportSnapshot(): Map<string, SymbolSnapshot> {
    return new Map(this.symbolMap);
  }

  importSnapshot(snapshots: Map<string, SymbolSnapshot>): void {
    this.clear();
    for (const [id, snapshot] of snapshots) {
      this.symbolMap.set(id, snapshot);

      if (!this.fileSymbolMap.has(snapshot.filePath)) {
        this.fileSymbolMap.set(snapshot.filePath, new Set());
      }
      this.fileSymbolMap.get(snapshot.filePath)!.add(id);
    }
    this.buildDependencyGraph();
  }

  clear(): void {
    this.symbolMap.clear();
    this.fileSymbolMap.clear();
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
    };
  }

  private processFile(file: ParsedFile): void {
    const filePath = file.path;
    this.fileSymbolMap.set(filePath, new Set());

    for (const symbol of file.symbols) {
      const symbolId = this.generateSymbolId(symbol, filePath);
      const snapshot: SymbolSnapshot = {
        id: symbolId,
        name: symbol.name,
        kind: symbol.kind,
        signature: symbol.signature || '',
        description: symbol.description || '',
        hash: this.computeSymbolHash(symbol),
        filePath,
        startLine: symbol.location?.line || 0,
        endLine: symbol.location?.endLine || 0,
        dependencies: this.extractDependencies(symbol),
        dependents: [],
        exported: this.isExported(symbol),
        imported: this.isImported(symbol),
      };

      this.symbolMap.set(symbolId, snapshot);
      this.fileSymbolMap.get(filePath)!.add(symbolId);
    }
  }

  private buildDependencyGraph(): void {
    for (const [symbolId, snapshot] of this.symbolMap) {
      this.dependencyGraph.nodes.set(symbolId, snapshot);

      if (!this.dependencyGraph.edges.has(symbolId)) {
        this.dependencyGraph.edges.set(symbolId, new Set());
      }

      for (const depName of snapshot.dependencies) {
        const depSymbol = this.findSymbolByName(depName, snapshot.filePath);
        if (depSymbol) {
          this.dependencyGraph.edges.get(symbolId)!.add(depSymbol.id);

          if (!this.dependencyGraph.reverseEdges.has(depSymbol.id)) {
            this.dependencyGraph.reverseEdges.set(depSymbol.id, new Set());
          }
          this.dependencyGraph.reverseEdges.get(depSymbol.id)!.add(symbolId);
        }
      }
    }
  }

  private generateSymbolId(symbol: CodeSymbol, filePath: string): string {
    return `${filePath}:${symbol.name}:${symbol.kind}`;
  }

  private computeSymbolHash(symbol: CodeSymbol): string {
    const data = `${symbol.name}:${symbol.kind}:${symbol.signature || ''}:${symbol.description || ''}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
  }

  private extractDependencies(symbol: CodeSymbol): string[] {
    const deps: string[] = [];

    if (symbol.members) {
      for (const member of symbol.members) {
        if (member.type) {
          const typeRefs = this.extractTypeReferences(member.type);
          deps.push(...typeRefs);
        }
      }
    }

    if (symbol.parameters) {
      for (const param of symbol.parameters) {
        if (param.type) {
          const typeRefs = this.extractTypeReferences(param.type);
          deps.push(...typeRefs);
        }
      }
    }

    if (symbol.returnType) {
      const typeRefs = this.extractTypeReferences(symbol.returnType);
      deps.push(...typeRefs);
    }

    return [...new Set(deps)];
  }

  private extractTypeReferences(type: string): string[] {
    const refs: string[] = [];
    const identifierPattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
    let match;

    while ((match = identifierPattern.exec(type)) !== null) {
      if (!['string', 'number', 'boolean', 'void', 'any', 'unknown', 'null', 'undefined', 'object', 'Promise', 'Array', 'Map', 'Set', 'Date', 'RegExp'].includes(match[1])) {
        refs.push(match[1]);
      }
    }

    return refs;
  }

  private isExported(symbol: CodeSymbol): boolean {
    return symbol.modifiers?.includes('export') || symbol.modifiers?.includes('public') || false;
  }

  private isImported(symbol: CodeSymbol): boolean {
    return symbol.modifiers?.includes('import') || false;
  }

  private findSymbolByName(name: string, contextFilePath: string): SymbolSnapshot | undefined {
    for (const snapshot of this.symbolMap.values()) {
      if (snapshot.name === name) {
        if (snapshot.filePath === contextFilePath || snapshot.exported) {
          return snapshot;
        }
      }
    }
    return undefined;
  }

  private assessImpact(snapshot: SymbolSnapshot, changeType: 'added' | 'modified' | 'deleted'): 'high' | 'medium' | 'low' {
    if (changeType === 'deleted') {
      const dependents = this.dependencyGraph.reverseEdges.get(snapshot.id);
      if (dependents && dependents.size > 5) {
        return 'high';
      } else if (dependents && dependents.size > 0) {
        return 'medium';
      }
      return 'low';
    }

    if (snapshot.exported) {
      return 'high';
    }

    if (snapshot.kind === SymbolKind.Class || snapshot.kind === SymbolKind.Interface) {
      return 'medium';
    }

    return 'low';
  }

  private prioritizeChanges(changes: SymbolChange[]): SymbolChange[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { deleted: 0, modified: 1, renamed: 2, added: 3 };

    return changes.sort((a, b) => {
      const impactDiff = priorityOrder[a.impactLevel] - priorityOrder[b.impactLevel];
      if (impactDiff !== 0) {
        return impactDiff;
      }
      return typeOrder[a.changeType] - typeOrder[b.changeType];
    });
  }

  private collectAffectedSymbols(symbolId: string, affected: Set<string>, depth: number): void {
    if (depth <= 0 || affected.has(symbolId)) {
      return;
    }

    affected.add(symbolId);

    const dependents = this.dependencyGraph.reverseEdges.get(symbolId);
    if (dependents) {
      for (const depId of dependents) {
        this.collectAffectedSymbols(depId, affected, depth - 1);
      }
    }
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split('/');
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1];
    }
    return parts[parts.length - 2] || 'root';
  }
}

export { IncrementalSymbolTracker as SymbolTracker };
