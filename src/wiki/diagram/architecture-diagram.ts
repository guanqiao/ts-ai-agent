import * as crypto from 'crypto';
import { ArchitectureReport } from '../../architecture/types';
import {
  IArchitectureDiagramGenerator,
  ArchitectureDiagram,
  DiagramNode,
  DiagramEdge,
  DiagramLayer,
  DiagramMetadata,
  LayeredDiagramConfig,
  ComponentDiagramConfig,
  DeploymentDiagramConfig,
  DiagramNodeType,
  DiagramEdgeType,
  NODE_TYPE_STYLES,
  EDGE_TYPE_STYLES,
  DiagramNodeStyle,
} from './types';

export class ArchitectureDiagramGenerator implements IArchitectureDiagramGenerator {
  private projectName: string = 'Unknown Project';

  setProjectName(name: string): void {
    this.projectName = name;
  }

  async generateLayeredDiagram(config: LayeredDiagramConfig): Promise<ArchitectureDiagram> {
    const now = new Date();
    const layers: DiagramLayer[] = [];
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];

    const sortedLayers = [...config.layers].sort((a, b) => a.order - b.order);

    let yOffset = 50;
    const layerHeight = 150;
    const nodeWidth = 200;
    const nodeHeight = 60;
    const nodeSpacing = 30;

    for (const layerDef of sortedLayers) {
      const layerNodes: string[] = [];
      let xOffset = 50;

      for (let i = 0; i < 3; i++) {
        const nodeId = `node-${crypto.randomBytes(4).toString('hex')}`;
        const nodeLabel = `${layerDef.name} Component ${i + 1}`;

        const node: DiagramNode = {
          id: nodeId,
          label: nodeLabel,
          type: 'component',
          position: { x: xOffset, y: yOffset + 40 },
          size: { width: nodeWidth, height: nodeHeight },
          style: this.getNodeStyle('component', layerDef.color),
        };

        nodes.push(node);
        layerNodes.push(nodeId);
        xOffset += nodeWidth + nodeSpacing;
      }

      layers.push({
        id: `layer-${layerDef.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: layerDef.name,
        order: layerDef.order,
        nodes: layerNodes,
        style: {
          backgroundColor: this.hexToRgba(layerDef.color, 0.1),
          borderColor: layerDef.color,
          labelPosition: 'left',
        },
      });

      yOffset += layerHeight;
    }

    if (config.showDependencies) {
      for (let i = 1; i < layers.length; i++) {
        const upperLayer = layers[i - 1];
        const lowerLayer = layers[i];

        for (const sourceId of upperLayer.nodes) {
          const targetId = lowerLayer.nodes[Math.floor(Math.random() * lowerLayer.nodes.length)];
          edges.push(this.createEdge(sourceId, targetId, 'dependency'));
        }
      }
    }

    return {
      id: `diagram-layered-${crypto.randomBytes(4).toString('hex')}`,
      name: `${this.projectName} - Layered Architecture`,
      description: 'Layered architecture diagram showing system layers and dependencies',
      type: 'layered',
      nodes,
      edges,
      layers,
      metadata: this.createMetadata(),
      createdAt: now,
      updatedAt: now,
    };
  }

  async generateComponentDiagram(config: ComponentDiagramConfig): Promise<ArchitectureDiagram> {
    const now = new Date();
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const layers: DiagramLayer[] = [];

    const componentTypes = [
      { name: 'UI Components', type: 'component' as DiagramNodeType, count: 4 },
      { name: 'Services', type: 'service' as DiagramNodeType, count: 3 },
      { name: 'Repositories', type: 'component' as DiagramNodeType, count: 2 },
      { name: 'External APIs', type: 'external' as DiagramNodeType, count: 2 },
    ];

    let yOffset = 50;
    const componentHeight = 120;
    const nodeWidth = 180;
    const nodeHeight = 70;

    for (const compType of componentTypes) {
      const layerNodes: string[] = [];
      const totalWidth = compType.count * nodeWidth + (compType.count - 1) * 30;
      let xOffset = Math.max(50, (800 - totalWidth) / 2);

      for (let i = 0; i < compType.count; i++) {
        const nodeId = `comp-${compType.name.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`;
        const nodeLabel = `${compType.name.slice(0, -1)} ${i + 1}`;

        const node: DiagramNode = {
          id: nodeId,
          label: nodeLabel,
          type: compType.type,
          description: `${compType.name} component`,
          position: { x: xOffset, y: yOffset },
          size: { width: nodeWidth, height: nodeHeight },
          style: this.getNodeStyle(compType.type),
          metadata: {
            componentType: compType.name,
          },
        };

        nodes.push(node);
        layerNodes.push(nodeId);
        xOffset += nodeWidth + 30;
      }

      layers.push({
        id: `layer-${compType.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: compType.name,
        order: componentTypes.indexOf(compType),
        nodes: layerNodes,
        style: {
          backgroundColor: 'transparent',
          borderColor: '#e0e0e0',
          labelPosition: 'left',
        },
      });

      yOffset += componentHeight;
    }

    if (config.showDependencies) {
      const uiNodes = nodes.filter((n) => n.metadata?.componentType === 'UI Components');
      const serviceNodes = nodes.filter((n) => n.metadata?.componentType === 'Services');
      const repoNodes = nodes.filter((n) => n.metadata?.componentType === 'Repositories');
      const externalNodes = nodes.filter((n) => n.metadata?.componentType === 'External APIs');

      for (const ui of uiNodes) {
        for (const service of serviceNodes.slice(0, 2)) {
          edges.push(this.createEdge(ui.id, service.id, 'dependency'));
        }
      }

      for (const service of serviceNodes) {
        for (const repo of repoNodes) {
          edges.push(this.createEdge(service.id, repo.id, 'dependency'));
        }
        for (const external of externalNodes) {
          edges.push(this.createEdge(service.id, external.id, 'communication'));
        }
      }
    }

    return {
      id: `diagram-component-${crypto.randomBytes(4).toString('hex')}`,
      name: `${this.projectName} - Component Diagram`,
      description: 'Component diagram showing system components and their relationships',
      type: 'component',
      nodes,
      edges,
      layers,
      metadata: this.createMetadata(),
      createdAt: now,
      updatedAt: now,
    };
  }

  async generateDeploymentDiagram(config: DeploymentDiagramConfig): Promise<ArchitectureDiagram> {
    const now = new Date();
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const layers: DiagramLayer[] = [];

    const environments =
      config.environments.length > 0 ? config.environments : this.getDefaultEnvironments();

    let xOffset = 50;
    const envWidth = 350;
    const envSpacing = 50;

    for (const env of environments) {
      const envNodes: string[] = [];
      let yOffset = 50;

      const envLayer: DiagramLayer = {
        id: `env-${env.name.toLowerCase()}`,
        name: env.name,
        order: environments.indexOf(env),
        nodes: [],
        style: {
          backgroundColor: this.getEnvBackgroundColor(env.type),
          borderColor: this.getEnvBorderColor(env.type),
          labelPosition: 'top',
        },
      };

      for (const deploymentNode of env.nodes) {
        const nodeId = `deploy-${env.name.toLowerCase()}-${deploymentNode.name.toLowerCase().replace(/\s+/g, '-')}`;
        const nodeType = this.mapDeploymentType(deploymentNode.type);

        const node: DiagramNode = {
          id: nodeId,
          label: deploymentNode.name,
          type: nodeType,
          description: `${env.name} ${deploymentNode.type}`,
          position: { x: xOffset + 30, y: yOffset },
          size: { width: 140, height: 60 },
          style: this.getNodeStyle(nodeType),
          metadata: {
            environment: env.name,
            nodeType: deploymentNode.type,
            components: deploymentNode.components,
          },
        };

        nodes.push(node);
        envNodes.push(nodeId);
        yOffset += 80;
      }

      envLayer.nodes = envNodes;
      layers.push(envLayer);
      xOffset += envWidth + envSpacing;
    }

    if (config.showConnections) {
      for (const env of environments) {
        for (const deploymentNode of env.nodes) {
          for (const conn of deploymentNode.connections) {
            const sourceId = `deploy-${env.name.toLowerCase()}-${deploymentNode.name.toLowerCase().replace(/\s+/g, '-')}`;
            const targetId = `deploy-${env.name.toLowerCase()}-${conn.target.toLowerCase().replace(/\s+/g, '-')}`;

            const existingEdge = edges.find((e) => e.source === sourceId && e.target === targetId);
            if (!existingEdge) {
              edges.push(this.createEdge(sourceId, targetId, 'dataflow', conn.type));
            }
          }
        }
      }
    }

    return {
      id: `diagram-deployment-${crypto.randomBytes(4).toString('hex')}`,
      name: `${this.projectName} - Deployment Diagram`,
      description: 'Deployment diagram showing infrastructure and deployment configuration',
      type: 'deployment',
      nodes,
      edges,
      layers,
      metadata: this.createMetadata(),
      createdAt: now,
      updatedAt: now,
    };
  }

  generateFromArchitecture(architecture: ArchitectureReport): ArchitectureDiagram {
    const now = new Date();
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const layers: DiagramLayer[] = [];

    let yOffset = 50;
    const layerHeight = 150;

    for (let i = 0; i < architecture.layers.length; i++) {
      const archLayer = architecture.layers[i];
      const layerNodes: string[] = [];
      let xOffset = 50;

      for (const module of archLayer.modules) {
        const nodeId = `module-${module.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        const node: DiagramNode = {
          id: nodeId,
          label: module.name,
          type: 'component',
          description: `Module: ${module.name}`,
          position: { x: xOffset, y: yOffset + 40 },
          size: { width: 180, height: 70 },
          style: this.getNodeStyle('component'),
          metadata: {
            symbolCount: module.symbols.length,
          },
        };

        nodes.push(node);
        layerNodes.push(nodeId);
        xOffset += 200;
      }

      layers.push({
        id: `layer-${archLayer.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: archLayer.name,
        order: i,
        nodes: layerNodes,
        style: {
          backgroundColor: this.hexToRgba(this.getLayerColor(i), 0.1),
          borderColor: this.getLayerColor(i),
          labelPosition: 'left',
        },
      });

      yOffset += layerHeight;
    }

    for (let i = 1; i < layers.length; i++) {
      const upperLayer = layers[i - 1];
      const lowerLayer = layers[i];

      for (const sourceId of upperLayer.nodes) {
        const targetId = lowerLayer.nodes[0];
        if (targetId) {
          edges.push(this.createEdge(sourceId, targetId, 'dependency'));
        }
      }
    }

    return {
      id: `diagram-arch-${crypto.randomBytes(4).toString('hex')}`,
      name: `${this.projectName} - Architecture`,
      description: `Architecture diagram for ${this.projectName}`,
      type: 'layered',
      nodes,
      edges,
      layers,
      metadata: this.createMetadata(),
      createdAt: now,
      updatedAt: now,
    };
  }

  private createEdge(
    source: string,
    target: string,
    type: DiagramEdgeType,
    label?: string
  ): DiagramEdge {
    const style = EDGE_TYPE_STYLES[type] || EDGE_TYPE_STYLES.dependency;

    return {
      id: `edge-${source}-${target}`,
      source,
      target,
      type,
      label,
      style: {
        color: style.color || '#666666',
        width: style.width || 1,
        style: style.style || 'solid',
        arrow: style.arrow || 'forward',
        animated: style.animated || false,
      },
    };
  }

  private getNodeStyle(type: DiagramNodeType, customColor?: string): DiagramNodeStyle {
    const baseStyle = NODE_TYPE_STYLES[type] || NODE_TYPE_STYLES.component;

    return {
      backgroundColor: customColor || baseStyle.backgroundColor || '#e3f2fd',
      borderColor: baseStyle.borderColor || '#2196f3',
      borderWidth: baseStyle.borderWidth || 1,
      borderRadius: baseStyle.borderRadius || 8,
      fontSize: 12,
      fontColor: '#212121',
    };
  }

  private createMetadata(): DiagramMetadata {
    return {
      projectName: this.projectName,
      version: '1.0.0',
      tags: ['architecture', 'diagram'],
    };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(200, 200, 200, ${alpha})`;

    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }

  private getLayerColor(index: number): string {
    const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4'];
    return colors[index % colors.length];
  }

  private getEnvBackgroundColor(type: string): string {
    const colors: Record<string, string> = {
      development: 'rgba(33, 150, 243, 0.1)',
      staging: 'rgba(255, 152, 0, 0.1)',
      production: 'rgba(76, 175, 80, 0.1)',
    };
    return colors[type] || 'rgba(158, 158, 158, 0.1)';
  }

  private getEnvBorderColor(type: string): string {
    const colors: Record<string, string> = {
      development: '#2196f3',
      staging: '#ff9800',
      production: '#4caf50',
    };
    return colors[type] || '#9e9e9e';
  }

  private mapDeploymentType(type: string): DiagramNodeType {
    const mapping: Record<string, DiagramNodeType> = {
      server: 'service',
      container: 'container',
      database: 'database',
      cache: 'service',
      queue: 'service',
      storage: 'database',
      cdn: 'external',
      loadbalancer: 'service',
    };
    return mapping[type] || 'component';
  }

  private getDefaultEnvironments(): import('./types').Environment[] {
    return [
      {
        name: 'Development',
        type: 'development',
        nodes: [
          {
            id: 'dev-server',
            name: 'Dev Server',
            type: 'server',
            components: ['api'],
            connections: [],
          },
          {
            id: 'dev-db',
            name: 'Dev Database',
            type: 'database',
            components: ['db'],
            connections: [{ target: 'Dev Server', type: 'tcp' }],
          },
        ],
      },
      {
        name: 'Production',
        type: 'production',
        nodes: [
          {
            id: 'prod-lb',
            name: 'Load Balancer',
            type: 'loadbalancer',
            components: ['nginx'],
            connections: [],
          },
          {
            id: 'prod-api',
            name: 'API Server',
            type: 'server',
            components: ['api'],
            connections: [{ target: 'Load Balancer', type: 'http' }],
          },
          {
            id: 'prod-db',
            name: 'Database',
            type: 'database',
            components: ['postgres'],
            connections: [{ target: 'API Server', type: 'tcp' }],
          },
        ],
      },
    ];
  }
}
