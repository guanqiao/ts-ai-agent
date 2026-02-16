import { ArchitectureDiagramGenerator } from '../../src/wiki/diagram/architecture-diagram';
import { DiagramExporter } from '../../src/wiki/diagram/diagram-exporter';
import {
  ArchitectureDiagram,
  LayeredDiagramConfig,
  ComponentDiagramConfig,
  DeploymentDiagramConfig,
  DiagramNode,
  DiagramEdge,
  DiagramLayer,
  DEFAULT_EXPORT_OPTIONS,
} from '../../src/wiki/diagram/types';

describe('ArchitectureDiagramGenerator', () => {
  let generator: ArchitectureDiagramGenerator;

  beforeEach(() => {
    generator = new ArchitectureDiagramGenerator();
    generator.setProjectName('TestProject');
  });

  describe('generateLayeredDiagram', () => {
    it('should generate a layered architecture diagram', async () => {
      const config: LayeredDiagramConfig = {
        layers: [
          { name: 'Presentation', patterns: ['ui/*'], color: '#2196f3', order: 0 },
          { name: 'Business', patterns: ['services/*'], color: '#4caf50', order: 1 },
          { name: 'Data', patterns: ['data/*'], color: '#ff9800', order: 2 },
        ],
        showDependencies: true,
        showDataFlow: false,
        groupByModule: false,
      };

      const diagram = await generator.generateLayeredDiagram(config);

      expect(diagram).toBeDefined();
      expect(diagram.type).toBe('layered');
      expect(diagram.layers.length).toBe(3);
      expect(diagram.nodes.length).toBeGreaterThan(0);
    });

    it('should create edges when showDependencies is true', async () => {
      const config: LayeredDiagramConfig = {
        layers: [
          { name: 'Layer1', patterns: ['*'], color: '#2196f3', order: 0 },
          { name: 'Layer2', patterns: ['*'], color: '#4caf50', order: 1 },
        ],
        showDependencies: true,
        showDataFlow: false,
        groupByModule: false,
      };

      const diagram = await generator.generateLayeredDiagram(config);
      expect(diagram.edges.length).toBeGreaterThan(0);
    });
  });

  describe('generateComponentDiagram', () => {
    it('should generate a component diagram', async () => {
      const config: ComponentDiagramConfig = {
        showInternals: true,
        showInterfaces: true,
        showDependencies: true,
        groupByNamespace: false,
      };

      const diagram = await generator.generateComponentDiagram(config);

      expect(diagram).toBeDefined();
      expect(diagram.type).toBe('component');
      expect(diagram.nodes.length).toBeGreaterThan(0);
    });

    it('should include different component types', async () => {
      const config: ComponentDiagramConfig = {
        showInternals: true,
        showInterfaces: true,
        showDependencies: true,
        groupByNamespace: false,
      };

      const diagram = await generator.generateComponentDiagram(config);
      const nodeTypes = new Set(diagram.nodes.map((n) => n.type));

      expect(nodeTypes.size).toBeGreaterThan(1);
    });
  });

  describe('generateDeploymentDiagram', () => {
    it('should generate a deployment diagram with default environments', async () => {
      const config: DeploymentDiagramConfig = {
        environments: [],
        showConnections: true,
        showDataFlow: false,
        includeInfrastructure: true,
      };

      const diagram = await generator.generateDeploymentDiagram(config);

      expect(diagram).toBeDefined();
      expect(diagram.type).toBe('deployment');
      expect(diagram.layers.length).toBeGreaterThan(0);
    });

    it('should use provided environments', async () => {
      const config: DeploymentDiagramConfig = {
        environments: [
          {
            name: 'Production',
            type: 'production',
            nodes: [
              {
                id: 'prod-1',
                name: 'Web Server',
                type: 'server',
                components: ['web'],
                connections: [],
              },
            ],
          },
        ],
        showConnections: false,
        showDataFlow: false,
        includeInfrastructure: false,
      };

      const diagram = await generator.generateDeploymentDiagram(config);

      expect(diagram.layers.length).toBe(1);
      expect(diagram.layers[0].name).toBe('Production');
    });
  });
});

describe('DiagramExporter', () => {
  let exporter: DiagramExporter;
  let sampleDiagram: ArchitectureDiagram;

  beforeEach(() => {
    exporter = new DiagramExporter();

    const nodes: DiagramNode[] = [
      {
        id: 'node-1',
        label: 'Component A',
        type: 'component',
        position: { x: 50, y: 50 },
        size: { width: 150, height: 60 },
        style: {
          backgroundColor: '#e3f2fd',
          borderColor: '#2196f3',
          borderWidth: 1,
          borderRadius: 8,
          fontSize: 12,
          fontColor: '#212121',
        },
      },
      {
        id: 'node-2',
        label: 'Component B',
        type: 'service',
        position: { x: 250, y: 50 },
        size: { width: 150, height: 60 },
        style: {
          backgroundColor: '#fff3e0',
          borderColor: '#ff9800',
          borderWidth: 1,
          borderRadius: 12,
          fontSize: 12,
          fontColor: '#212121',
        },
      },
    ];

    const edges: DiagramEdge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'dependency',
        style: {
          color: '#666666',
          width: 1,
          style: 'solid',
          arrow: 'forward',
          animated: false,
        },
      },
    ];

    const layers: DiagramLayer[] = [
      {
        id: 'layer-1',
        name: 'Application',
        order: 0,
        nodes: ['node-1', 'node-2'],
        style: {
          backgroundColor: '#f5f5f5',
          borderColor: '#e0e0e0',
          labelPosition: 'top',
        },
      },
    ];

    sampleDiagram = {
      id: 'test-diagram',
      name: 'Test Diagram',
      type: 'component',
      nodes,
      edges,
      layers,
      metadata: {
        projectName: 'TestProject',
        version: '1.0.0',
        tags: ['test'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('exportToMermaid', () => {
    it('should export diagram to Mermaid format', () => {
      const mermaid = exporter.exportToMermaid(sampleDiagram);

      expect(mermaid).toContain('```mermaid');
      expect(mermaid).toContain('flowchart');
    });

    it('should include nodes in Mermaid output', () => {
      const mermaid = exporter.exportToMermaid(sampleDiagram);

      expect(mermaid).toContain('node-1');
      expect(mermaid).toContain('node-2');
    });

    it('should include edges in Mermaid output', () => {
      const mermaid = exporter.exportToMermaid(sampleDiagram);

      expect(mermaid).toContain('-->');
    });
  });

  describe('exportToSVG', () => {
    it('should export diagram to SVG format', () => {
      const svg = exporter.exportToSVG(sampleDiagram);

      expect(svg).toContain('<?xml version="1.0"');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('should include nodes as rectangles', () => {
      const svg = exporter.exportToSVG(sampleDiagram);

      expect(svg).toContain('<rect');
      expect(svg).toContain('Component A');
      expect(svg).toContain('Component B');
    });

    it('should include edges as lines', () => {
      const svg = exporter.exportToSVG(sampleDiagram);

      expect(svg).toContain('<line');
    });
  });

  describe('exportToJSON', () => {
    it('should export diagram to JSON format', () => {
      const json = exporter.exportToJSON(sampleDiagram);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('test-diagram');
      expect(parsed.name).toBe('Test Diagram');
      expect(parsed.nodes.length).toBe(2);
      expect(parsed.edges.length).toBe(1);
    });

    it('should include metadata when requested', () => {
      const json = exporter.exportToJSON(sampleDiagram, { ...DEFAULT_EXPORT_OPTIONS, includeMetadata: true });
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.projectName).toBe('TestProject');
    });
  });

  describe('exportToDrawIO', () => {
    it('should export diagram to DrawIO format', () => {
      const drawIO = exporter.exportToDrawIO(sampleDiagram);

      expect(drawIO).toContain('<mxGraphModel');
      expect(drawIO).toContain('<mxCell');
    });

    it('should include nodes as mxCell elements', () => {
      const drawIO = exporter.exportToDrawIO(sampleDiagram);

      expect(drawIO).toContain('vertex="1"');
    });
  });

  describe('exportToPNG', () => {
    it('should return a buffer for PNG export', async () => {
      const png = await exporter.exportToPNG(sampleDiagram);

      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });
  });
});

describe('Diagram Types and Styles', () => {
  it('should have consistent node type styles', () => {
    const { NODE_TYPE_STYLES } = require('../../src/wiki/diagram/types');

    expect(NODE_TYPE_STYLES.component).toBeDefined();
    expect(NODE_TYPE_STYLES.service).toBeDefined();
    expect(NODE_TYPE_STYLES.database).toBeDefined();
    expect(NODE_TYPE_STYLES.external).toBeDefined();
  });

  it('should have consistent edge type styles', () => {
    const { EDGE_TYPE_STYLES } = require('../../src/wiki/diagram/types');

    expect(EDGE_TYPE_STYLES.dependency).toBeDefined();
    expect(EDGE_TYPE_STYLES.dataflow).toBeDefined();
    expect(EDGE_TYPE_STYLES.communication).toBeDefined();
    expect(EDGE_TYPE_STYLES.inheritance).toBeDefined();
  });

  it('should have default export options', () => {
    const { DEFAULT_EXPORT_OPTIONS } = require('../../src/wiki/diagram/types');

    expect(DEFAULT_EXPORT_OPTIONS.format).toBe('mermaid');
    expect(DEFAULT_EXPORT_OPTIONS.scale).toBe(1);
    expect(DEFAULT_EXPORT_OPTIONS.includeMetadata).toBe(true);
  });
});
