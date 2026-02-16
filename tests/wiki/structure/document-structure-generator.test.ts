import { DocumentStructureGenerator } from '../../../src/wiki/structure/document-structure-generator';
import { SectionRecommender } from '../../../src/wiki/structure/section-recommender';
import { ContentOrganizer } from '../../../src/wiki/structure/content-organizer';
import { SectionType, SectionPriority, DocumentSection } from '../../../src/wiki/structure/types';
import { ParsedFile, SymbolKind, Language } from '../../../src/types';

function createMockLocation(file: string) {
  return { file, line: 1, column: 1 };
}

describe('DocumentStructureGenerator', () => {
  let generator: DocumentStructureGenerator;

  const mockParsedFiles: ParsedFile[] = [
    {
      path: 'src/index.ts',
      language: Language.TypeScript,
      symbols: [
        {
          name: 'main',
          kind: SymbolKind.Function,
          description: 'Main entry point',
          location: createMockLocation('src/index.ts'),
          modifiers: ['export'],
        },
      ],
      imports: [],
      exports: [{ name: 'main', kind: SymbolKind.Function, isDefault: false }],
    },
    {
      path: 'src/module1/service.ts',
      language: Language.TypeScript,
      symbols: [
        {
          name: 'Service',
          kind: SymbolKind.Class,
          description: 'Main service class',
          location: createMockLocation('src/module1/service.ts'),
          modifiers: ['export'],
          members: [
            { name: 'run', kind: SymbolKind.Method, type: 'void', location: createMockLocation('src/module1/service.ts') },
          ],
        },
      ],
      imports: [],
      exports: [{ name: 'Service', kind: SymbolKind.Class, isDefault: false }],
    },
    {
      path: 'src/module1/types.ts',
      language: Language.TypeScript,
      symbols: [
        {
          name: 'IConfig',
          kind: SymbolKind.Interface,
          description: 'Configuration interface',
          location: createMockLocation('src/module1/types.ts'),
          modifiers: ['export'],
          members: [
            { name: 'port', kind: SymbolKind.Property, type: 'number', location: createMockLocation('src/module1/types.ts') },
          ],
        },
      ],
      imports: [],
      exports: [{ name: 'IConfig', kind: SymbolKind.Interface, isDefault: false }],
    },
  ];

  const mockArchitecture = {
    pattern: 'Layered Architecture',
    layers: [
      { name: 'Presentation', modules: ['ui'] },
      { name: 'Business', modules: ['module1'] },
    ],
    modules: [
      { name: 'module1', path: 'src/module1', symbols: [], dependencies: [] },
    ],
    metrics: {
      totalFiles: 3,
      totalSymbols: 3,
      averageCohesion: 0.8,
      averageCoupling: 0.3,
      circularDependencies: 0,
    },
  };

  beforeEach(() => {
    generator = new DocumentStructureGenerator();
  });

  describe('generateStructure', () => {
    it('should generate a valid section hierarchy', async () => {
      const hierarchy = await generator.generateStructure(mockParsedFiles, mockArchitecture);

      expect(hierarchy).toBeDefined();
      expect(hierarchy.root).toBeDefined();
      expect(hierarchy.flatSections.length).toBeGreaterThan(0);
      expect(hierarchy.totalSections).toBe(hierarchy.flatSections.length);
    });

    it('should include overview section', async () => {
      const hierarchy = await generator.generateStructure(mockParsedFiles, mockArchitecture);

      const overviewSection = hierarchy.flatSections.find(
        (s) => s.type === SectionType.Overview
      );
      expect(overviewSection).toBeDefined();
      expect(overviewSection?.priority).toBe(SectionPriority.Critical);
    });

    it('should include architecture section', async () => {
      const hierarchy = await generator.generateStructure(mockParsedFiles, mockArchitecture);

      const archSection = hierarchy.flatSections.find(
        (s) => s.type === SectionType.Architecture
      );
      expect(archSection).toBeDefined();
    });

    it('should include module sections', async () => {
      const hierarchy = await generator.generateStructure(mockParsedFiles, mockArchitecture);

      const moduleSections = hierarchy.flatSections.filter(
        (s) => s.type === SectionType.Module
      );
      expect(moduleSections.length).toBeGreaterThan(0);
    });

    it('should include API sections for public symbols', async () => {
      const hierarchy = await generator.generateStructure(mockParsedFiles, mockArchitecture);

      const apiSections = hierarchy.flatSections.filter(
        (s) => s.type === SectionType.API
      );
      expect(apiSections.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeContent', () => {
    it('should identify missing sections', async () => {
      const existingSections: DocumentSection[] = [
        {
          id: 'overview',
          title: 'Overview',
          type: SectionType.Overview,
          priority: SectionPriority.Critical,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'overview' },
          sourceFiles: [],
          symbols: [],
        },
      ];

      const result = await generator.analyzeContent(existingSections, mockParsedFiles);

      expect(result.missingSections.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should identify redundant sections', async () => {
      const existingSections: DocumentSection[] = [
        {
          id: 'old-module',
          title: 'Old Module',
          type: SectionType.Module,
          priority: SectionPriority.High,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'module' },
          sourceFiles: ['src/deleted-module/index.ts'],
          symbols: [],
        },
      ];

      const result = await generator.analyzeContent(existingSections, mockParsedFiles);

      expect(result.redundantSections.length).toBeGreaterThan(0);
    });
  });

  describe('suggestSections', () => {
    it('should suggest missing section types', async () => {
      const suggestions = await generator.suggestSections(mockParsedFiles, []);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === SectionType.Overview)).toBe(true);
    });

    it('should not suggest existing section types', async () => {
      const existingSections: DocumentSection[] = [
        {
          id: 'overview',
          title: 'Overview',
          type: SectionType.Overview,
          priority: SectionPriority.Critical,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'overview' },
          sourceFiles: [],
          symbols: [],
        },
      ];

      const suggestions = await generator.suggestSections(mockParsedFiles, existingSections);

      expect(suggestions.some((s) => s.type === SectionType.Overview)).toBe(false);
    });
  });
});

describe('SectionRecommender', () => {
  let recommender: SectionRecommender;

  beforeEach(() => {
    recommender = new SectionRecommender();
  });

  describe('recommendSections', () => {
    it('should recommend overview for all projects', async () => {
      const parsedFiles: ParsedFile[] = [
        {
          path: 'src/index.ts',
          language: Language.TypeScript,
          symbols: [],
          imports: [],
          exports: [],
        },
      ];

      const recommendations = await recommender.recommendSections(parsedFiles, []);

      expect(recommendations.some((r) => r.section.type === SectionType.Overview)).toBe(true);
    });

    it('should recommend API section for projects with public APIs', async () => {
      const parsedFiles: ParsedFile[] = [
        {
          path: 'src/api.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'publicAPI',
              kind: SymbolKind.Function,
              location: createMockLocation('src/api.ts'),
              modifiers: ['export'],
            },
          ],
          imports: [],
          exports: [{ name: 'publicAPI', kind: SymbolKind.Function, isDefault: false }],
        },
      ];

      const recommendations = await recommender.recommendSections(parsedFiles, []);

      expect(recommendations.some((r) => r.section.type === SectionType.API)).toBe(true);
    });
  });

  describe('prioritizeSections', () => {
    it('should sort sections by priority', () => {
      const sections: DocumentSection[] = [
        {
          id: 'low',
          title: 'Low Priority',
          type: SectionType.Changelog,
          priority: SectionPriority.Low,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'changelog' },
          sourceFiles: [],
          symbols: [],
        },
        {
          id: 'critical',
          title: 'Critical',
          type: SectionType.Overview,
          priority: SectionPriority.Critical,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'overview' },
          sourceFiles: [],
          symbols: [],
        },
      ];

      const prioritized = recommender.prioritizeSections(sections);

      expect(prioritized[0].priority).toBe(SectionPriority.Critical);
      expect(prioritized[1].priority).toBe(SectionPriority.Low);
    });
  });
});

describe('ContentOrganizer', () => {
  let organizer: ContentOrganizer;

  beforeEach(() => {
    organizer = new ContentOrganizer();
  });

  describe('organizeContent', () => {
    it('should organize sections correctly', () => {
      const sections: DocumentSection[] = [
        {
          id: 'section1',
          title: 'Section 1',
          type: SectionType.Module,
          priority: SectionPriority.High,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'module' },
          sourceFiles: [],
          symbols: [],
        },
        {
          id: 'section2',
          title: 'Section 2',
          type: SectionType.Overview,
          priority: SectionPriority.Critical,
          level: 1,
          children: [],
          metadata: { tags: [], category: 'overview' },
          sourceFiles: [],
          symbols: [],
        },
      ];

      const result = organizer.organizeContent(sections);

      expect(result).toBeDefined();
      expect(result.sections.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('mergeSections', () => {
    it('should merge multiple sections into one', () => {
      const sections: DocumentSection[] = [
        {
          id: 'section1',
          title: 'Section 1',
          type: SectionType.Module,
          priority: SectionPriority.High,
          level: 1,
          children: [],
          metadata: { tags: ['tag1'], category: 'module' },
          sourceFiles: ['file1.ts'],
          symbols: ['symbol1'],
        },
        {
          id: 'section2',
          title: 'Section 2',
          type: SectionType.Module,
          priority: SectionPriority.Medium,
          level: 1,
          children: [],
          metadata: { tags: ['tag2'], category: 'module' },
          sourceFiles: ['file2.ts'],
          symbols: ['symbol2'],
        },
      ];

      const merged = organizer.mergeSections(sections);

      expect(merged.id).toContain('merged');
      expect(merged.sourceFiles).toContain('file1.ts');
      expect(merged.sourceFiles).toContain('file2.ts');
      expect(merged.symbols).toContain('symbol1');
      expect(merged.symbols).toContain('symbol2');
    });
  });

  describe('splitSection', () => {
    it('should not split small sections', () => {
      const section: DocumentSection = {
        id: 'small',
        title: 'Small Section',
        type: SectionType.Module,
        priority: SectionPriority.High,
        level: 1,
        content: 'Short content',
        children: [],
        metadata: { tags: [], category: 'module' },
        sourceFiles: [],
        symbols: [],
      };

      const split = organizer.splitSection(section);

      expect(split.length).toBe(1);
      expect(split[0].id).toBe('small');
    });

    it('should split large sections', () => {
      const largeContent = 'A'.repeat(5000);
      const section: DocumentSection = {
        id: 'large',
        title: 'Large Section',
        type: SectionType.Module,
        priority: SectionPriority.High,
        level: 1,
        content: largeContent,
        children: [],
        metadata: { tags: [], category: 'module' },
        sourceFiles: [],
        symbols: [],
      };

      const split = organizer.splitSection(section);

      expect(split.length).toBeGreaterThan(1);
    });
  });
});
