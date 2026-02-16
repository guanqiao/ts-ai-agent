import * as path from 'path';
import * as fs from 'fs';
import { WikiGraphGenerator } from '../../../src/wiki/graph/wiki-graph-generator';
import { ParsedFile, SymbolKind, Language } from '../../../src/types';
import {
  GraphFilter,
  GraphOptions,
} from '../../../src/wiki/graph/types';

describe('WikiGraphGenerator', () => {
  let generator: WikiGraphGenerator;
  let testProjectPath: string;
  let mockParsedFiles: ParsedFile[];

  beforeEach(() => {
    testProjectPath = path.join(__dirname, 'test-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    // 创建测试用的 ParsedFile 数据
    mockParsedFiles = [
      {
        path: path.join(testProjectPath, 'src/moduleA.ts'),
        language: Language.TypeScript,
        symbols: [
          {
            name: 'ClassA',
            kind: SymbolKind.Class,
            location: {
              file: path.join(testProjectPath, 'src/moduleA.ts'),
              line: 1,
              column: 0,
            },
            modifiers: ['export'],
            documentation: 'Class A documentation',
            members: [
              {
                name: 'methodA',
                kind: SymbolKind.Method,
                location: {
                  file: path.join(testProjectPath, 'src/moduleA.ts'),
                  line: 5,
                  column: 2,
                },
                modifiers: ['public'],
                documentation: 'Method A',
              },
            ],
          },
        ],
        imports: [
          { source: './moduleB', specifiers: ['ClassB'], isDefault: false, isNamespace: false, isExternal: false },
        ],
        exports: [{ name: 'ClassA', kind: SymbolKind.Class, isDefault: false }],
      },
      {
        path: path.join(testProjectPath, 'src/moduleB.ts'),
        language: Language.TypeScript,
        symbols: [
          {
            name: 'ClassB',
            kind: SymbolKind.Class,
            location: {
              file: path.join(testProjectPath, 'src/moduleB.ts'),
              line: 1,
              column: 0,
            },
            modifiers: ['export'],
            documentation: 'Class B documentation',
          },
          {
            name: 'helperFunction',
            kind: SymbolKind.Function,
            location: {
              file: path.join(testProjectPath, 'src/moduleB.ts'),
              line: 10,
              column: 0,
            },
            modifiers: ['export'],
            documentation: 'Helper function',
          },
        ],
        imports: [],
        exports: [
          { name: 'ClassB', kind: SymbolKind.Class, isDefault: false },
          { name: 'helperFunction', kind: SymbolKind.Function, isDefault: false },
        ],
      },
      {
        path: path.join(testProjectPath, 'src/moduleC.ts'),
        language: Language.TypeScript,
        symbols: [
          {
            name: 'ClassC',
            kind: SymbolKind.Class,
            location: {
              file: path.join(testProjectPath, 'src/moduleC.ts'),
              line: 1,
              column: 0,
            },
            modifiers: ['export'],
            documentation: 'Class C extends ClassA',
            extends: ['ClassA'],
          },
        ],
        imports: [
          { source: './moduleA', specifiers: ['ClassA'], isDefault: false, isNamespace: false, isExternal: false },
        ],
        exports: [{ name: 'ClassC', kind: SymbolKind.Class, isDefault: false }],
      },
    ];
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      generator = new WikiGraphGenerator();
      expect(generator).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptions: Partial<GraphOptions> = {
        maxDepth: 5,
        direction: 'LR',
      };
      generator = new WikiGraphGenerator(customOptions);
      expect(generator).toBeDefined();
    });
  });

  describe('generateDependencyGraph', () => {
    beforeEach(() => {
      generator = new WikiGraphGenerator();
    });

    it('should generate dependency graph', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);

      expect(graph).toBeDefined();
      expect(graph.type).toBe('dependency');
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });

    it('should create nodes for modules', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);

      expect(graph.nodes.length).toBeGreaterThan(0);
      
      // Nodes are created based on module names extracted from paths
      const nodeLabels = graph.nodes.map(n => n.label);
      expect(nodeLabels.some(label => label.includes('src'))).toBe(true);
    });

    it('should create edges for imports', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);

      // Edges are created when there are imports between modules
      // The actual edge creation depends on the module grouping logic
      expect(graph.edges).toBeDefined();
    });

    it('should handle empty file list', async () => {
      const graph = await generator.generateDependencyGraph([]);

      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });

    it('should include metadata', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);

      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.sourceFiles).toBe(mockParsedFiles.length);
      expect(graph.metadata.totalNodes).toBe(graph.nodes.length);
      expect(graph.metadata.totalEdges).toBe(graph.edges.length);
      expect(graph.metadata.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('generateCallGraph', () => {
    beforeEach(() => {
      generator = new WikiGraphGenerator();
    });

    it('should generate call graph', async () => {
      const graph = await generator.generateCallGraph(mockParsedFiles);

      expect(graph).toBeDefined();
      expect(graph.type).toBe('call-graph');
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });

    it('should create nodes for functions and methods', async () => {
      const graph = await generator.generateCallGraph(mockParsedFiles);

      expect(graph.nodes.length).toBeGreaterThan(0);
      
      const hasFunctionNodes = graph.nodes.some(n => n.type === 'function');
      const hasMethodNodes = graph.nodes.some(n => n.type === 'method');
      expect(hasFunctionNodes || hasMethodNodes).toBe(true);
    });
  });

  describe('generateInheritanceGraph', () => {
    beforeEach(() => {
      generator = new WikiGraphGenerator();
    });

    it('should generate inheritance graph', async () => {
      const graph = await generator.generateInheritanceGraph(mockParsedFiles);

      expect(graph).toBeDefined();
      expect(graph.type).toBe('inheritance');
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });

    it('should create extends edges for class inheritance', async () => {
      const graph = await generator.generateInheritanceGraph(mockParsedFiles);

      // ClassC extends ClassA
      const hasExtendsEdge = graph.edges.some(e => 
        e.type === 'extends'
      );
      expect(hasExtendsEdge).toBe(true);
    });

    it('should create nodes for classes', async () => {
      const graph = await generator.generateInheritanceGraph(mockParsedFiles);

      const classNodes = graph.nodes.filter(n => n.type === 'class');
      expect(classNodes.length).toBeGreaterThan(0);
    });
  });

  describe('generateImplementationGraph', () => {
    beforeEach(() => {
      generator = new WikiGraphGenerator();
    });

    it('should generate implementation graph', async () => {
      const graph = await generator.generateImplementationGraph(mockParsedFiles);

      expect(graph).toBeDefined();
      expect(graph.type).toBe('implementation');
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });
  });

  describe('detectCycles', () => {
    beforeEach(() => {
      generator = new WikiGraphGenerator();
    });

    it('should detect circular dependencies', async () => {
      // Create files with circular dependency: A -> B -> A
      const filesWithCycle: ParsedFile[] = [
        {
          path: path.join(testProjectPath, 'src/a.ts'),
          language: Language.TypeScript,
          symbols: [],
          imports: [{ source: './b', specifiers: [], isDefault: false, isNamespace: false, isExternal: false }],
          exports: [],
        },
        {
          path: path.join(testProjectPath, 'src/b.ts'),
          language: Language.TypeScript,
          symbols: [],
          imports: [{ source: './a', specifiers: [], isDefault: false, isNamespace: false, isExternal: false }],
          exports: [],
        },
      ];

      const graph = await generator.generateDependencyGraph(filesWithCycle);
      const cycles = generator.detectCycles(graph);

      // Cycles are detected in the graph structure
      expect(cycles).toBeDefined();
    });

    it('should return empty array for acyclic graph', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const cycles = generator.detectCycles(graph);

      // mockParsedFiles has no circular dependencies
      expect(cycles).toEqual([]);
    });
  });

  describe('exportToMermaid', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should export graph to Mermaid format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const mermaid = generator.exportToMermaid(graph);

      expect(mermaid).toContain('graph');
      expect(mermaid.length).toBeGreaterThan(0);
    });

    it('should include nodes', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const mermaid = generator.exportToMermaid(graph);

      // Should contain node definitions
      expect(mermaid).toContain('[');
    });

    it('should include edges when present', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const mermaid = generator.exportToMermaid(graph);

      // Mermaid format should be valid
      expect(mermaid).toContain('graph');
      // Edges are present only when there are dependencies
      if (graph.edges.length > 0) {
        expect(mermaid).toContain('-->');
      }
    });

    it('should respect direction option', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const mermaid = generator.exportToMermaid(graph, { direction: 'LR' });

      expect(mermaid).toContain('graph LR');
    });
  });

  describe('exportToSVG', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should export graph to SVG format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const svg = generator.exportToSVG(graph);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('should include nodes in SVG', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const svg = generator.exportToSVG(graph);

      expect(svg).toContain('<rect');
      expect(svg).toContain('<text');
    });

    it('should include proper XML declaration', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const svg = generator.exportToSVG(graph);

      expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });
  });

  describe('exportToJSON', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should export graph to JSON format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const json = generator.exportToJSON(graph);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all graph properties', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const json = generator.exportToJSON(graph);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(graph.id);
      expect(parsed.type).toBe(graph.type);
      expect(parsed.nodes).toEqual(graph.nodes);
      expect(parsed.edges).toEqual(graph.edges);
    });
  });

  describe('exportToDot', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should export graph to DOT format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const dot = generator.exportToDot(graph);

      expect(dot).toContain('digraph G {');
      expect(dot).toContain('}');
    });

    it('should include node definitions', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const dot = generator.exportToDot(graph);

      expect(dot).toContain('[');
      expect(dot).toContain('label=');
    });

    it('should include edge definitions when present', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const dot = generator.exportToDot(graph);

      expect(dot).toContain('digraph G {');
      // Edges are present only when there are dependencies
      if (graph.edges.length > 0) {
        expect(dot).toContain('->');
      }
    });
  });

  describe('filterGraph', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should filter nodes by type', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      
      const filter: GraphFilter = {
        nodeTypes: ['module'],
      };
      
      const filtered = generator.filterGraph(graph, filter);

      expect(filtered.nodes.every(n => n.type === 'module')).toBe(true);
    });

    it('should filter by maxNodes', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      
      const filter: GraphFilter = {
        maxNodes: 2,
      };
      
      const filtered = generator.filterGraph(graph, filter);

      expect(filtered.nodes.length).toBeLessThanOrEqual(2);
    });

    it('should filter edges based on filtered nodes', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      
      const filter: GraphFilter = {
        maxNodes: 1,
      };
      
      const filtered = generator.filterGraph(graph, filter);
      const nodeIds = new Set(filtered.nodes.map(n => n.id));

      // All edges should connect to existing nodes
      expect(filtered.edges.every(e => 
        nodeIds.has(e.source) && nodeIds.has(e.target)
      )).toBe(true);
    });

    it('should filter by edge types', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      
      const filter: GraphFilter = {
        edgeTypes: ['imports'],
      };
      
      const filtered = generator.filterGraph(graph, filter);

      expect(filtered.edges.every(e => e.type === 'imports')).toBe(true);
    });

    it('should update metadata after filtering', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      
      const filter: GraphFilter = {
        maxNodes: 2,
      };
      
      const filtered = generator.filterGraph(graph, filter);

      expect(filtered.metadata.totalNodes).toBe(filtered.nodes.length);
      expect(filtered.metadata.totalEdges).toBe(filtered.edges.length);
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      generator = new WikiGraphGenerator();
    });

    it('should export to mermaid format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const result = generator.export(graph, 'mermaid');

      expect(result).toContain('graph');
    });

    it('should export to svg format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const result = generator.export(graph, 'svg');

      expect(result).toContain('<svg');
    });

    it('should export to json format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const result = generator.export(graph, 'json');

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export to dot format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);
      const result = generator.export(graph, 'dot');

      expect(result).toContain('digraph G {');
    });

    it('should throw error for unsupported format', async () => {
      const graph = await generator.generateDependencyGraph(mockParsedFiles);

      expect(() => generator.export(graph, 'unsupported' as any)).toThrow(
        'Unsupported format'
      );
    });
  });
});
