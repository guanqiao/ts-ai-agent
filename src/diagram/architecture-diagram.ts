import * as crypto from 'crypto';
import { ArchitectureReport, LayerInfo, ModuleInfo, DependencyGraph } from '../architecture/types';
import { ParsedFile } from '../types';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  DiagramMetadata,
  ArchitectureDiagramConfig,
  DEFAULT_ARCHITECTURE_CONFIG,
} from './types';
import { MermaidGenerator } from './mermaid-generator';

export class ArchitectureDiagramGenerator {
  private config: ArchitectureDiagramConfig;
  private mermaidGenerator: MermaidGenerator;

  constructor(config?: Partial<ArchitectureDiagramConfig>) {
    this.config = { ...DEFAULT_ARCHITECTURE_CONFIG, ...config };
    this.mermaidGenerator = new MermaidGenerator();
  }

  async generate(architecture: ArchitectureReport, sourceFiles?: ParsedFile[]): Promise<Diagram> {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const clusters: DiagramCluster[] = [];

    if (this.config.showLayers && architecture.layers.length > 0) {
      this.generateLayerClusters(architecture.layers, clusters, nodes, edges);
    }

    if (this.config.showModules && architecture.modules.length > 0) {
      this.generateModuleNodes(architecture.modules, nodes, edges);
    }

    if (this.config.showDependencies && architecture.dependencyGraph) {
      this.generateDependencyEdges(architecture.dependencyGraph, edges);
    }

    const metadata: DiagramMetadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      sourceFiles: sourceFiles?.map((f) => f.path) || [],
      generator: 'architecture-diagram-generator',
    };

    return {
      id: this.generateDiagramId(),
      type: 'architecture',
      title: 'Architecture Overview',
      description: `Architecture pattern: ${architecture.pattern.pattern}`,
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  private generateLayerClusters(
    layers: LayerInfo[],
    clusters: DiagramCluster[],
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): void {
    layers.forEach((layer, layerIndex) => {
      const clusterId = `layer-${layerIndex}`;

      const cluster: DiagramCluster = {
        id: clusterId,
        label: layer.name,
        nodes: [],
        style: {
          fill: this.getLayerColor(layerIndex),
          stroke: '#333',
          strokeWidth: 1,
        },
      };

      if (layer.modules && layer.modules.length > 0) {
        layer.modules.forEach((module: ModuleInfo) => {
          const nodeId = `module-${this.sanitizeId(module.name)}`;

          nodes.push({
            id: nodeId,
            label: module.name,
            type: 'module',
            shape: 'rounded',
            metadata: {
              symbolCount: module.symbols?.length || 0,
            },
          });

          cluster.nodes.push(nodeId);
        });
      }

      clusters.push(cluster);

      if (layerIndex > 0) {
        edges.push({
          id: `layer-edge-${layerIndex}`,
          source: `layer-${layerIndex - 1}`,
          target: clusterId,
          type: 'dependency',
          label: 'uses',
        });
      }
    });
  }

  private generateModuleNodes(
    modules: ModuleInfo[],
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): void {
    modules.forEach((module) => {
      const nodeId = `module-${this.sanitizeId(module.name)}`;

      const existingNode = nodes.find((n) => n.id === nodeId);
      if (!existingNode) {
        nodes.push({
          id: nodeId,
          label: module.name,
          type: 'module',
          shape: 'rounded',
          metadata: {
            path: module.path,
            symbolCount: module.symbols?.length || 0,
          },
        });
      }

      if (module.dependencies) {
        module.dependencies.forEach((dep: string) => {
          const depId = `module-${this.sanitizeId(dep)}`;
          edges.push({
            id: `dep-${nodeId}-${depId}`,
            source: nodeId,
            target: depId,
            type: 'dependency',
          });
        });
      }
    });
  }

  private generateDependencyEdges(
    dependencyGraph: DependencyGraph,
    edges: DiagramEdge[]
  ): void {
    const existingEdges = new Set(edges.map((e) => `${e.source}->${e.target}`));

    for (const [moduleName] of dependencyGraph.nodes) {
      const sourceId = `module-${this.sanitizeId(moduleName)}`;
      const deps = dependencyGraph.adjacencyList.get(moduleName) || new Set<string>();

      for (const dep of deps) {
        const targetId = `module-${this.sanitizeId(dep)}`;
        const edgeKey = `${sourceId}->${targetId}`;

        if (!existingEdges.has(edgeKey)) {
          edges.push({
            id: `dep-${crypto.randomBytes(4).toString('hex')}`,
            source: sourceId,
            target: targetId,
            type: 'dependency',
          });
          existingEdges.add(edgeKey);
        }
      }
    }
  }

  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private getLayerColor(index: number): string {
    const colors = [
      '#E3F2FD',
      '#FFF3E0',
      '#E8F5E9',
      '#FCE4EC',
      '#F3E5F5',
      '#E0F7FA',
    ];
    return colors[index % colors.length];
  }

  private generateDiagramId(): string {
    return `arch-diagram-${crypto.randomBytes(4).toString('hex')}`;
  }

  export(diagram: Diagram): string {
    return this.mermaidGenerator.export(diagram);
  }

  setConfig(config: Partial<ArchitectureDiagramConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ArchitectureDiagramConfig {
    return { ...this.config };
  }

  generateMermaidCode(architecture: ArchitectureReport, sourceFiles?: ParsedFile[]): Promise<string> {
    return this.generate(architecture, sourceFiles).then((diagram) => this.export(diagram));
  }
}
