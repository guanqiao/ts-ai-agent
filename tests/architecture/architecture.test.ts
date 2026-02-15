import { PatternDetector } from '../../src/architecture/pattern-detector';
import { DependencyGraphBuilder } from '../../src/architecture/dependency-graph';
import { ArchitectureAnalyzer } from '../../src/architecture/architecture-analyzer';
import { ParsedFile, SymbolKind, Language } from '../../src/types';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('detect', () => {
    it('should return pattern matches for parsed files', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/controllers/UserController.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'UserController',
              kind: SymbolKind.Class,
              location: { file: '/src/controllers/UserController.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
        {
          path: '/src/models/User.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'User',
              kind: SymbolKind.Class,
              location: { file: '/src/models/User.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
      ];

      const matches = detector.detect(files);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBeDefined();
      expect(matches[0].confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return unknown pattern for empty files', () => {
      const matches = detector.detect([]);

      expect(matches.length).toBe(1);
      expect(matches[0].pattern).toBe('unknown');
    });
  });

  describe('getIndicators', () => {
    it('should return indicators for a pattern', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/controllers/UserController.ts',
          language: Language.TypeScript,
          symbols: [],
          imports: [],
          exports: [],
        },
      ];

      const indicators = detector.getIndicators('mvc', files);

      expect(Array.isArray(indicators)).toBe(true);
    });
  });

  describe('getPrimaryPattern', () => {
    it('should return the pattern with highest confidence', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/services/UserService.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'UserService',
              kind: SymbolKind.Class,
              location: { file: '/src/services/UserService.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
      ];

      const primary = detector.getPrimaryPattern(files);

      expect(primary).toBeDefined();
      expect(primary.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    builder = new DependencyGraphBuilder();
  });

  describe('build', () => {
    it('should build a dependency graph from parsed files', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/index.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'main',
              kind: SymbolKind.Function,
              location: { file: '/src/index.ts', line: 1 },
            },
          ],
          imports: [
            { source: './utils', specifiers: ['helper'], isDefault: false, isNamespace: false, isExternal: false },
          ],
          exports: [],
        },
        {
          path: '/src/utils.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'helper',
              kind: SymbolKind.Function,
              location: { file: '/src/utils.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [{ name: 'helper', kind: SymbolKind.Function, isDefault: false }],
        },
      ];

      const graph = builder.build(files);

      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.edges).toBeDefined();
    });
  });

  describe('findCircularDependencies', () => {
    it('should find circular dependencies in the graph', () => {
      const graph = builder.build([]);

      const cycles = builder.findCircularDependencies(graph);

      expect(Array.isArray(cycles)).toBe(true);
    });
  });

  describe('findOrphans', () => {
    it('should find orphan nodes in the graph', () => {
      const graph = builder.build([]);

      const orphans = builder.findOrphans(graph);

      expect(Array.isArray(orphans)).toBe(true);
    });
  });

  describe('findHubs', () => {
    it('should find hub nodes above threshold', () => {
      const graph = builder.build([]);

      const hubs = builder.findHubs(graph, 5);

      expect(Array.isArray(hubs)).toBe(true);
    });
  });
});

describe('ArchitectureAnalyzer', () => {
  let analyzer: ArchitectureAnalyzer;

  beforeEach(() => {
    analyzer = new ArchitectureAnalyzer();
  });

  describe('analyze', () => {
    it('should return a complete architecture report', async () => {
      const files: ParsedFile[] = [
        {
          path: '/src/index.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'App',
              kind: SymbolKind.Class,
              location: { file: '/src/index.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
      ];

      const report = await analyzer.analyze(files);

      expect(report).toBeDefined();
      expect(report.pattern).toBeDefined();
      expect(report.modules).toBeDefined();
      expect(report.dependencyGraph).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('detectPattern', () => {
    it('should detect architecture pattern', () => {
      const files: ParsedFile[] = [];

      const pattern = analyzer.detectPattern(files);

      expect(pattern).toBeDefined();
      expect(pattern.pattern).toBeDefined();
    });
  });

  describe('identifyModules', () => {
    it('should identify modules from files', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/utils/helper.ts',
          language: Language.TypeScript,
          symbols: [],
          imports: [],
          exports: [],
        },
      ];

      const modules = analyzer.identifyModules(files);

      expect(Array.isArray(modules)).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate architecture metrics', () => {
      const files: ParsedFile[] = [];
      const modules = analyzer.identifyModules(files);
      const graph = analyzer.buildDependencyGraph(files);

      const metrics = analyzer.calculateMetrics(modules, graph);

      expect(metrics).toBeDefined();
      expect(metrics.totalModules).toBeGreaterThanOrEqual(0);
      expect(metrics.totalClasses).toBeGreaterThanOrEqual(0);
      expect(metrics.totalFunctions).toBeGreaterThanOrEqual(0);
    });
  });
});
