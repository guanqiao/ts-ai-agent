import * as crypto from 'crypto';
import { ArchitectureReport, DependencyGraph } from '../architecture/types';
import { ParsedFile } from '../types';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  DiagramMetadata,
  DependencyDiagramConfig,
  DEFAULT_DEPENDENCY_CONFIG,
} from './types';
import { MermaidGenerator } from './mermaid-generator';

export class DependencyDiagramGenerator {
  private config: DependencyDiagramConfig;
  private mermaidGenerator: MermaidGenerator;

  constructor(config?: Partial<DependencyDiagramConfig>) {
    this.config = { ...DEFAULT_DEPENDENCY_CONFIG, ...config };
    this.mermaidGenerator = new MermaidGenerator();
  }

  async generate(architecture: ArchitectureReport, parsedFiles?: ParsedFile[]): Promise<Diagram> {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const clusters: DiagramCluster[] = [];

    const moduleMap = new Map<string, Set<string>>();
    const circularDependencies: string[][] = [];

    if (parsedFiles) {
      this.buildDependencyMap(parsedFiles, moduleMap);
    }

    if (architecture.dependencyGraph) {
      this.buildFromDependencyGraph(architecture.dependencyGraph, moduleMap);
    }

    if (this.config.showCircular) {
      this.detectCircularDependencies(moduleMap, circularDependencies);
    }

    this.generateNodes(moduleMap, nodes);
    this.generateEdges(moduleMap, edges, circularDependencies);

    const metadata: DiagramMetadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      sourceFiles: parsedFiles?.map((f) => f.path) || [],
      generator: 'dependency-diagram-generator',
    };

    return {
      id: this.generateDiagramId(),
      type: 'dependency',
      title: 'Dependency Graph',
      description: `Module dependencies with ${circularDependencies.length} circular dependencies`,
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  private buildDependencyMap(parsedFiles: ParsedFile[], moduleMap: Map<string, Set<string>>): void {
    for (const file of parsedFiles) {
      const moduleName = this.extractModuleName(file.path);

      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, new Set());
      }

      const imports = this.extractImports(file);
      for (const imp of imports) {
        const targetModule = this.resolveImportToModule(imp, file.path);
        if (targetModule && targetModule !== moduleName) {
          if (this.shouldIncludeModule(targetModule)) {
            moduleMap.get(moduleName)!.add(targetModule);
          }
        }
      }
    }
  }

  private buildFromDependencyGraph(
    dependencyGraph: DependencyGraph,
    moduleMap: Map<string, Set<string>>
  ): void {
    for (const [moduleName] of dependencyGraph.nodes) {
      if (!this.shouldIncludeModule(moduleName)) continue;

      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, new Set());
      }

      const deps = dependencyGraph.adjacencyList.get(moduleName) || new Set<string>();
      for (const dep of deps) {
        if (this.shouldIncludeModule(dep)) {
          moduleMap.get(moduleName)!.add(dep);
          // Also ensure the dependency module exists in moduleMap for complete circular detection
          if (!moduleMap.has(dep)) {
            moduleMap.set(dep, new Set());
          }
        }
      }
    }
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0 && srcIndex < parts.length - 1) {
      return parts.slice(srcIndex, srcIndex + 2).join('/');
    }
    return parts[parts.length - 2] || 'root';
  }

  private extractImports(file: ParsedFile): string[] {
    const imports: string[] = [];
    const content = file.rawContent || '';

    const importPatterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private resolveImportToModule(importPath: string, _sourcePath: string): string | null {
    if (importPath.startsWith('.')) {
      return this.extractModuleName(importPath);
    }

    if (importPath.startsWith('@') || !importPath.includes('/')) {
      return this.config.showExternal ? importPath.split('/')[0] : null;
    }

    return importPath.split('/').slice(0, 2).join('/');
  }

  private shouldIncludeModule(moduleName: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (moduleName.includes(pattern)) {
        return false;
      }
    }

    if (this.config.filter.length > 0) {
      return this.config.filter.some((f) => moduleName.includes(f));
    }

    return true;
  }

  private detectCircularDependencies(
    moduleMap: Map<string, Set<string>>,
    circularDeps: string[][]
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (module: string): void => {
      visited.add(module);
      recursionStack.add(module);
      path.push(module);

      const deps = moduleMap.get(module);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            dfs(dep);
          } else if (recursionStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            if (cycleStart >= 0) {
              circularDeps.push([...path.slice(cycleStart), dep]);
            }
          }
        }
      }

      path.pop();
      recursionStack.delete(module);
    };

    for (const module of moduleMap.keys()) {
      if (!visited.has(module)) {
        dfs(module);
      }
    }
  }

  private generateNodes(moduleMap: Map<string, Set<string>>, nodes: DiagramNode[]): void {
    const allModules = new Set<string>();

    for (const [module, deps] of moduleMap) {
      allModules.add(module);
      for (const dep of deps) {
        allModules.add(dep);
      }
    }

    for (const module of allModules) {
      nodes.push({
        id: this.sanitizeModuleId(module),
        label: module,
        type: this.isExternalModule(module) ? 'external' : 'module',
        shape: this.isExternalModule(module) ? 'hexagon' : 'rounded',
      });
    }
  }

  private generateEdges(
    moduleMap: Map<string, Set<string>>,
    edges: DiagramEdge[],
    circularDeps: string[][]
  ): void {
    const circularSet = new Set<string>();

    for (const cycle of circularDeps) {
      for (let i = 0; i < cycle.length - 1; i++) {
        circularSet.add(`${cycle[i]}->${cycle[i + 1]}`);
      }
    }

    for (const [source, deps] of moduleMap) {
      for (const target of deps) {
        const edgeKey = `${source}->${target}`;
        const isCircular = circularSet.has(edgeKey);

        edges.push({
          id: `edge-${crypto.randomBytes(2).toString('hex')}`,
          source: this.sanitizeModuleId(source),
          target: this.sanitizeModuleId(target),
          type: 'dependency',
          style: {
            line: isCircular ? 'dashed' : 'solid',
            color: isCircular ? '#FF5722' : undefined,
          },
        });
      }
    }
  }

  private isExternalModule(moduleName: string): boolean {
    return !moduleName.includes('/') && !moduleName.includes('\\');
  }

  private sanitizeModuleId(moduleName: string): string {
    return moduleName.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private generateDiagramId(): string {
    return `dep-diagram-${crypto.randomBytes(4).toString('hex')}`;
  }

  export(diagram: Diagram): string {
    return this.mermaidGenerator.export(diagram);
  }

  setConfig(config: Partial<DependencyDiagramConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DependencyDiagramConfig {
    return { ...this.config };
  }

  generateMermaidCode(
    architecture: ArchitectureReport,
    parsedFiles?: ParsedFile[]
  ): Promise<string> {
    return this.generate(architecture, parsedFiles).then((diagram) => this.export(diagram));
  }

  getCircularDependencies(
    architecture: ArchitectureReport,
    parsedFiles?: ParsedFile[]
  ): Promise<string[][]> {
    const moduleMap = new Map<string, Set<string>>();
    const circularDeps: string[][] = [];

    if (parsedFiles) {
      this.buildDependencyMap(parsedFiles, moduleMap);
    }

    if (architecture.dependencyGraph) {
      this.buildFromDependencyGraph(architecture.dependencyGraph, moduleMap);
    }

    this.detectCircularDependencies(moduleMap, circularDeps);

    return Promise.resolve(circularDeps);
  }
}
