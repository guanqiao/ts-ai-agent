import {
  extractSections,
  groupSymbolsByKind,
  getModuleName,
  getSymbolCounts,
  formatSymbolList,
  escapeMarkdown,
  generateAnchorId,
  isPublicSymbol,
  isPrivateSymbol,
  sortByVisibility,
  extractDescription,
  WikiSection,
  GroupedSymbols,
} from '@utils/content-utils';
import { CodeSymbol, SymbolKind } from '@/types';

describe('content-utils', () => {
  describe('extractSections', () => {
    it('should extract sections from markdown content', () => {
      const content = `# Main Title

Some intro text.

## Section 1

Content for section 1.

### Subsection 1.1

More content.

## Section 2

Content for section 2.`;

      const sections = extractSections(content);

      expect(sections.length).toBe(4);
      expect(sections[0].title).toBe('Main Title');
      expect(sections[0].level).toBe(1);
      expect(sections[1].title).toBe('Section 1');
      expect(sections[1].level).toBe(2);
    });

    it('should return empty array for empty content', () => {
      const sections = extractSections('');
      expect(sections).toHaveLength(0);
    });

    it('should return empty array for content without headers', () => {
      const content = 'Just some text\nwithout any headers';
      const sections = extractSections(content);
      expect(sections).toHaveLength(0);
    });
  });

  describe('groupSymbolsByKind', () => {
    const createSymbol = (name: string, kind: SymbolKind): CodeSymbol => ({
      name,
      kind,
      location: { file: 'test.ts', line: 1 },
    });

    it('should group symbols by kind', () => {
      const symbols: CodeSymbol[] = [
        createSymbol('MyClass', SymbolKind.Class),
        createSymbol('IMyInterface', SymbolKind.Interface),
        createSymbol('myFunction', SymbolKind.Function),
        createSymbol('MyType', SymbolKind.TypeAlias),
        createSymbol('MyEnum', SymbolKind.Enum),
        createSymbol('myVar', SymbolKind.Variable),
        createSymbol('MY_CONST', SymbolKind.Constant),
      ];

      const grouped = groupSymbolsByKind(symbols);

      expect(grouped.classes).toHaveLength(1);
      expect(grouped.interfaces).toHaveLength(1);
      expect(grouped.functions).toHaveLength(1);
      expect(grouped.types).toHaveLength(1);
      expect(grouped.enums).toHaveLength(1);
      expect(grouped.variables).toHaveLength(1);
      expect(grouped.constants).toHaveLength(1);
    });

    it('should group methods with functions', () => {
      const symbols: CodeSymbol[] = [
        createSymbol('myMethod', SymbolKind.Method),
      ];

      const grouped = groupSymbolsByKind(symbols);

      expect(grouped.functions).toHaveLength(1);
    });

    it('should return empty arrays for empty input', () => {
      const grouped = groupSymbolsByKind([]);

      expect(grouped.classes).toHaveLength(0);
      expect(grouped.interfaces).toHaveLength(0);
      expect(grouped.functions).toHaveLength(0);
    });
  });

  describe('getModuleName', () => {
    it('should extract module name from src path', () => {
      expect(getModuleName('/project/src/wiki/wiki-manager.ts')).toBe('wiki');
      expect(getModuleName('/project/src/llm/base.ts')).toBe('llm');
    });

    it('should handle Windows paths', () => {
      expect(getModuleName('C:\\project\\src\\core\\di\\index.ts')).toBe('core');
    });

    it('should return parent directory for non-src paths', () => {
      expect(getModuleName('/project/wiki/index.md')).toBe('wiki');
    });

    it('should return root for shallow paths', () => {
      expect(getModuleName('index.ts')).toBe('root');
    });
  });

  describe('getSymbolCounts', () => {
    it('should count symbols by kind', () => {
      const symbols: CodeSymbol[] = [
        { name: 'A', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
        { name: 'B', kind: SymbolKind.Class, location: { file: 'test.ts', line: 2 } },
        { name: 'C', kind: SymbolKind.Function, location: { file: 'test.ts', line: 3 } },
      ];

      const counts = getSymbolCounts(symbols);

      expect(counts.get(SymbolKind.Class)).toBe(2);
      expect(counts.get(SymbolKind.Function)).toBe(1);
    });
  });

  describe('formatSymbolList', () => {
    it('should format symbol list', () => {
      const symbols: CodeSymbol[] = [
        { name: 'ClassA', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
        { name: 'ClassB', kind: SymbolKind.Class, location: { file: 'test.ts', line: 2 } },
      ];

      const result = formatSymbolList(symbols);

      expect(result).toContain('`ClassA`');
      expect(result).toContain('`ClassB`');
    });

    it('should truncate long lists', () => {
      const symbols: CodeSymbol[] = Array.from({ length: 15 }, (_, i) => ({
        name: `Symbol${i}`,
        kind: SymbolKind.Class,
        location: { file: 'test.ts', line: i },
      }));

      const result = formatSymbolList(symbols, 10);

      expect(result).toContain('and 5 more');
    });
  });

  describe('escapeMarkdown', () => {
    it('should escape special characters', () => {
      expect(escapeMarkdown('*bold*')).toBe('\\*bold\\*');
      expect(escapeMarkdown('# heading')).toBe('\\# heading');
      expect(escapeMarkdown('[link]')).toBe('\\[link\\]');
    });
  });

  describe('generateAnchorId', () => {
    it('should generate valid anchor IDs', () => {
      expect(generateAnchorId('My Section')).toBe('my-section');
      expect(generateAnchorId('API Reference')).toBe('api-reference');
      expect(generateAnchorId('What\'s New?')).toBe('what-s-new');
    });
  });

  describe('isPublicSymbol', () => {
    it('should return true for exported symbols', () => {
      const symbol: CodeSymbol = {
        name: 'MyClass',
        kind: SymbolKind.Class,
        location: { file: 'test.ts', line: 1 },
        modifiers: ['export'],
      };

      expect(isPublicSymbol(symbol)).toBe(true);
    });

    it('should return false for private symbols', () => {
      const symbol: CodeSymbol = {
        name: 'MyClass',
        kind: SymbolKind.Class,
        location: { file: 'test.ts', line: 1 },
      };

      expect(isPublicSymbol(symbol)).toBe(false);
    });
  });

  describe('isPrivateSymbol', () => {
    it('should return true for private symbols', () => {
      const symbol: CodeSymbol = {
        name: 'MyClass',
        kind: SymbolKind.Class,
        location: { file: 'test.ts', line: 1 },
        modifiers: ['private'],
      };

      expect(isPrivateSymbol(symbol)).toBe(true);
    });

    it('should return true for underscore-prefixed names', () => {
      const symbol: CodeSymbol = {
        name: '_privateVar',
        kind: SymbolKind.Variable,
        location: { file: 'test.ts', line: 1 },
      };

      expect(isPrivateSymbol(symbol)).toBe(true);
    });
  });

  describe('sortByVisibility', () => {
    it('should sort public symbols first', () => {
      const symbols: CodeSymbol[] = [
        { name: 'Z', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
        { name: 'A', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 }, modifiers: ['export'] },
        { name: 'M', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
      ];

      const sorted = sortByVisibility(symbols);

      expect(sorted[0].name).toBe('A');
    });
  });

  describe('extractDescription', () => {
    it('should extract description from JSDoc', () => {
      expect(extractDescription('/** My description */')).toBe('My description');
    });

    it('should return first line only', () => {
      expect(extractDescription('First line\nSecond line')).toBe('First line');
    });

    it('should return empty string for undefined', () => {
      expect(extractDescription(undefined)).toBe('');
    });
  });
});
