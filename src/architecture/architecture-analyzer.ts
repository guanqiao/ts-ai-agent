import * as path from 'path';
import { ParsedFile, SymbolKind, CodeSymbol } from '../types';
import {
  IArchitectureAnalyzer,
  ArchitectureReport,
  PatternMatch,
  DependencyGraph,
  ModuleInfo,
  LayerInfo,
  BusinessFlow,
  TechnicalDecision,
  ArchitectureMetrics,
} from './types';
import { PatternDetector } from './pattern-detector';
import { DependencyGraphBuilder } from './dependency-graph';

export class ArchitectureAnalyzer implements IArchitectureAnalyzer {
  private patternDetector: PatternDetector;
  private graphBuilder: DependencyGraphBuilder;

  constructor() {
    this.patternDetector = new PatternDetector();
    this.graphBuilder = new DependencyGraphBuilder();
  }

  async analyze(files: ParsedFile[]): Promise<ArchitectureReport> {
    const pattern = this.detectPattern(files);
    const modules = this.identifyModules(files);
    const dependencyGraph = this.buildDependencyGraph(files);
    const layers = this.identifyLayers(modules);
    const businessFlows = this.identifyCoreFlows(files);
    const technicalDecisions = this.detectDecisions(files);
    const metrics = this.calculateMetrics(modules, dependencyGraph);
    const recommendations = this.generateRecommendations(pattern, metrics, dependencyGraph);

    return {
      pattern,
      modules,
      layers,
      dependencyGraph,
      businessFlows,
      technicalDecisions,
      metrics,
      recommendations,
      generatedAt: new Date(),
    };
  }

  detectPattern(files: ParsedFile[]): PatternMatch {
    return this.patternDetector.getPrimaryPattern(files);
  }

  buildDependencyGraph(files: ParsedFile[]): DependencyGraph {
    return this.graphBuilder.build(files);
  }

  identifyModules(files: ParsedFile[]): ModuleInfo[] {
    const modules: ModuleInfo[] = [];

    for (const file of files) {
      const modulePath = path.dirname(file.path);
      const moduleName = path.basename(modulePath);

      const existingModule = modules.find((m) => m.path === modulePath);

      if (existingModule) {
        existingModule.symbols.push(...file.symbols);
        existingModule.imports.push(
          ...file.imports.map((i) => i.source).filter((s) => !existingModule.imports.includes(s))
        );
        existingModule.exports.push(
          ...file.exports.map((e) => e.name).filter((n) => !existingModule.exports.includes(n))
        );
      } else {
        modules.push({
          name: moduleName,
          path: modulePath,
          symbols: [...file.symbols],
          imports: file.imports.map((i) => i.source),
          exports: file.exports.map((e) => e.name),
          dependencies: [],
          dependents: [],
          cohesion: 0,
          coupling: 0,
        });
      }
    }

    this.calculateModuleMetrics(modules, files);

    return modules;
  }

  identifyLayers(modules: ModuleInfo[]): LayerInfo[] {
    const layerPatterns: { name: string; patterns: RegExp[]; description: string }[] = [
      {
        name: 'Presentation',
        patterns: [/controller/i, /view/i, /component/i, /page/i, /ui/i, /screen/i],
        description: 'User interface and presentation logic',
      },
      {
        name: 'Application',
        patterns: [/service/i, /usecase/i, /use-case/i, /application/i, /app/i],
        description: 'Application business logic and orchestration',
      },
      {
        name: 'Domain',
        patterns: [/domain/i, /entity/i, /model/i, /aggregate/i, /value.?object/i],
        description: 'Core domain model and business rules',
      },
      {
        name: 'Infrastructure',
        patterns: [/repository/i, /dao/i, /persistence/i, /infrastructure/i, /adapter/i, /client/i],
        description: 'External integrations and infrastructure',
      },
    ];

    const layers: LayerInfo[] = layerPatterns.map((lp) => ({
      name: lp.name,
      modules: [],
      dependencies: [],
      description: lp.description,
    }));

    for (const module of modules) {
      let assigned = false;

      for (let i = 0; i < layerPatterns.length; i++) {
        const layerPattern = layerPatterns[i];
        const matches = layerPattern.patterns.some(
          (p) => p.test(module.name) || module.symbols.some((s) => p.test(s.name))
        );

        if (matches) {
          layers[i].modules.push(module);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        layers.find((l) => l.name === 'Application')?.modules.push(module);
      }
    }

    for (const layer of layers) {
      layer.dependencies = this.identifyLayerDependencies(layer, layers);
    }

    return layers.filter((l) => l.modules.length > 0);
  }

  identifyCoreFlows(files: ParsedFile[]): BusinessFlow[] {
    const flows: BusinessFlow[] = [];

    const entryPoints = this.findEntryPoints(files);

    for (const entryPoint of entryPoints) {
      const flow = this.traceFlow(entryPoint, files);
      if (flow) {
        flows.push(flow);
      }
    }

    return flows;
  }

  detectDecisions(files: ParsedFile[]): TechnicalDecision[] {
    const decisions: TechnicalDecision[] = [];

    for (const file of files) {
      const fileDecisions = this.extractDecisionsFromFile(file);
      decisions.push(...fileDecisions);
    }

    return decisions;
  }

  calculateMetrics(modules: ModuleInfo[], graph: DependencyGraph): ArchitectureMetrics {
    const totalModules = modules.length;
    const totalClasses = modules.reduce(
      (sum, m) => sum + m.symbols.filter((s) => s.kind === SymbolKind.Class).length,
      0
    );
    const totalFunctions = modules.reduce(
      (sum, m) =>
        sum +
        m.symbols.filter((s) => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method)
          .length,
      0
    );
    const totalInterfaces = modules.reduce(
      (sum, m) => sum + m.symbols.filter((s) => s.kind === SymbolKind.Interface).length,
      0
    );

    const averageCohesion =
      modules.reduce((sum, m) => sum + m.cohesion, 0) / Math.max(totalModules, 1);
    const averageCoupling =
      modules.reduce((sum, m) => sum + m.coupling, 0) / Math.max(totalModules, 1);

    const circularDependencies = this.graphBuilder.findCircularDependencies(graph).length;

    const maxDependencyDepth = this.calculateMaxDependencyDepth(graph);

    const codeReuseRatio = this.calculateCodeReuseRatio(modules);

    return {
      totalModules,
      totalClasses,
      totalFunctions,
      totalInterfaces,
      averageCohesion,
      averageCoupling,
      circularDependencies,
      maxDependencyDepth,
      codeReuseRatio,
    };
  }

  private calculateModuleMetrics(modules: ModuleInfo[], _files: ParsedFile[]): void {
    for (const module of modules) {
      const moduleSymbols = module.symbols.length;
      let internalConnections = 0;
      let externalConnections = 0;

      for (const symbol of module.symbols) {
        if (symbol.dependencies) {
          for (const dep of symbol.dependencies) {
            const depModule = modules.find((m) => m.symbols.some((s) => s.name === dep.name));
            if (depModule === module) {
              internalConnections++;
            } else if (depModule) {
              externalConnections++;
              if (!module.dependencies.includes(depModule.name)) {
                module.dependencies.push(depModule.name);
              }
            }
          }
        }
      }

      module.cohesion = moduleSymbols > 0 ? internalConnections / moduleSymbols : 0;
      module.coupling = externalConnections;

      for (const otherModule of modules) {
        if (otherModule.dependencies.includes(module.name)) {
          if (!module.dependents.includes(otherModule.name)) {
            module.dependents.push(otherModule.name);
          }
        }
      }
    }
  }

  private identifyLayerDependencies(layer: LayerInfo, allLayers: LayerInfo[]): string[] {
    const dependencies: string[] = [];

    for (const module of layer.modules) {
      for (const dep of module.dependencies) {
        const depLayer = allLayers.find((l) => l.modules.some((m) => m.name === dep));
        if (depLayer && depLayer.name !== layer.name && !dependencies.includes(depLayer.name)) {
          dependencies.push(depLayer.name);
        }
      }
    }

    return dependencies;
  }

  private findEntryPoints(files: ParsedFile[]): CodeSymbol[] {
    const entryPoints: CodeSymbol[] = [];

    for (const file of files) {
      for (const symbol of file.symbols) {
        const isEntryPoint =
          symbol.kind === SymbolKind.Class &&
          (symbol.name.includes('Controller') ||
            symbol.name.includes('Handler') ||
            symbol.name.includes('Service') ||
            symbol.name === 'main' ||
            symbol.name === 'index');

        if (isEntryPoint) {
          entryPoints.push(symbol);
        }
      }
    }

    return entryPoints;
  }

  private traceFlow(entryPoint: CodeSymbol, files: ParsedFile[]): BusinessFlow | null {
    const steps = this.traceSymbolFlow(entryPoint, files, new Set<string>());

    if (steps.length === 0) return null;

    return {
      id: `flow-${entryPoint.name}`,
      name: `${entryPoint.name} Flow`,
      description: entryPoint.description,
      steps,
      entryPoints: [entryPoint.name],
      exitPoints: steps.filter((s) => s.nextSteps.length === 0).map((s) => s.name),
    };
  }

  private traceSymbolFlow(
    symbol: CodeSymbol,
    files: ParsedFile[],
    visited: Set<string>
  ): {
    id: string;
    name: string;
    type: 'function' | 'class' | 'module';
    filePath: string;
    nextSteps: string[];
  }[] {
    const key = `${symbol.name}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const file = files.find((f) => f.symbols.includes(symbol));
    if (!file) return [];

    const steps: {
      id: string;
      name: string;
      type: 'function' | 'class' | 'module';
      filePath: string;
      nextSteps: string[];
    }[] = [];

    const step = {
      id: `step-${symbol.name}`,
      name: symbol.name,
      type: (symbol.kind === SymbolKind.Class ? 'class' : 'function') as
        | 'function'
        | 'class'
        | 'module',
      filePath: file.path,
      nextSteps: [] as string[],
    };

    steps.push(step);

    if (symbol.members) {
      for (const member of symbol.members) {
        if (member.kind === SymbolKind.Method) {
          step.nextSteps.push(member.name);
        }
      }
    }

    if (symbol.dependencies) {
      for (const dep of symbol.dependencies) {
        if (!dep.isExternal) {
          const depSymbol = this.findSymbolInFiles(dep.name, files);
          if (depSymbol) {
            const subSteps = this.traceSymbolFlow(depSymbol, files, visited);
            steps.push(...subSteps);
            if (subSteps.length > 0) {
              step.nextSteps.push(dep.name);
            }
          }
        }
      }
    }

    return steps;
  }

  private findSymbolInFiles(name: string, files: ParsedFile[]): CodeSymbol | null {
    for (const file of files) {
      const symbol = file.symbols.find((s) => s.name === name);
      if (symbol) return symbol;
    }
    return null;
  }

  private extractDecisionsFromFile(file: ParsedFile): TechnicalDecision[] {
    const decisions: TechnicalDecision[] = [];

    if (file.rawContent) {
      const decisionPatterns = [
        /@decision\s+(.+)/gi,
        /\/\/\s*DECISION:\s*(.+)/gi,
        /\*\s*DECISION:\s*(.+)/gi,
        /#\s*DECISION:\s*(.+)/gi,
        /TODO:\s*consider\s+(.+)/gi,
        /FIXME:\s*(.+)/gi,
      ];

      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(file.rawContent)) !== null) {
          decisions.push({
            id: `decision-${file.path}-${decisions.length}`,
            title: match[1].trim(),
            description: `Technical decision found in ${file.path}`,
            relatedFiles: [file.path],
            detectedAt: new Date(),
          });
        }
      }
    }

    for (const symbol of file.symbols) {
      if (symbol.decorators) {
        for (const decorator of symbol.decorators) {
          if (decorator.name.toLowerCase().includes('deprecated')) {
            decisions.push({
              id: `decision-${file.path}-${symbol.name}-deprecated`,
              title: `${symbol.name} is deprecated`,
              description: `The ${symbol.name} ${symbol.kind} has been marked as deprecated`,
              rationale: decorator.arguments?.join(', ') || 'No reason provided',
              relatedFiles: [file.path],
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return decisions;
  }

  private calculateMaxDependencyDepth(graph: DependencyGraph): number {
    let maxDepth = 0;
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      maxDepth = Math.max(maxDepth, depth);

      const neighbors = graph.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor, depth + 1);
        }
      }
    };

    for (const nodeId of graph.nodes.keys()) {
      visited.clear();
      dfs(nodeId, 0);
    }

    return maxDepth;
  }

  private calculateCodeReuseRatio(modules: ModuleInfo[]): number {
    const allSymbols = modules.flatMap((m) => m.symbols);
    const uniqueSymbols = new Set(allSymbols.map((s) => s.name));

    if (allSymbols.length === 0) return 0;

    return uniqueSymbols.size / allSymbols.length;
  }

  private generateRecommendations(
    pattern: PatternMatch,
    metrics: ArchitectureMetrics,
    graph: DependencyGraph
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.circularDependencies > 0) {
      recommendations.push(
        `Found ${metrics.circularDependencies} circular dependencies. Consider refactoring to eliminate them.`
      );
    }

    if (metrics.averageCoupling > 10) {
      recommendations.push(
        'High coupling detected. Consider applying the Dependency Inversion Principle to reduce coupling between modules.'
      );
    }

    if (metrics.averageCohesion < 0.3) {
      recommendations.push(
        'Low cohesion detected. Consider splitting modules with low cohesion into smaller, more focused modules.'
      );
    }

    if (metrics.maxDependencyDepth > 5) {
      recommendations.push(
        `Deep dependency chain detected (depth: ${metrics.maxDependencyDepth}). Consider flattening the architecture.`
      );
    }

    if (pattern.confidence < 0.5) {
      recommendations.push(
        'Architecture pattern is unclear. Consider establishing a consistent architectural pattern across the codebase.'
      );
    }

    const hubs = this.graphBuilder.findHubs(graph, 10);
    if (hubs.length > 0) {
      recommendations.push(
        `Found ${hubs.length} highly connected modules. Consider whether these modules have too many responsibilities.`
      );
    }

    return recommendations;
  }
}
