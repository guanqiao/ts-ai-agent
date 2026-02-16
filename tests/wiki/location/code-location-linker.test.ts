import { CodeLocationLinker } from '../../../src/wiki/location/code-location-linker';
import { SymbolTracker } from '../../../src/wiki/location/symbol-tracker';
import { LocationIndex } from '../../../src/wiki/location/location-index';
import { SymbolLocation, FileLocation } from '../../../src/wiki/location/types';
import { ParsedFile, SymbolKind, Language } from '../../../src/types';

describe('CodeLocationLinker', () => {
  let linker: CodeLocationLinker;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    linker = new CodeLocationLinker(testProjectPath);
  });

  describe('createLink', () => {
    it('should create a file link', async () => {
      const target: FileLocation = {
        filePath: 'src/index.ts',
        range: {
          start: { line: 1, column: 0 },
          end: { line: 10, column: 0 },
        },
      };

      const link = await linker.createLink('page-1', target);

      expect(link.id).toBeDefined();
      expect(link.pageId).toBe('page-1');
      expect(link.target.filePath).toBe('src/index.ts');
    });

    it('should create a symbol link', async () => {
      const target: SymbolLocation = {
        symbolName: 'UserService',
        kind: 'class',
        filePath: 'src/services/user.ts',
        range: {
          start: { line: 5, column: 0 },
          end: { line: 50, column: 1 },
        },
      };

      const link = await linker.createLink('page-2', target, 'UserService Class');

      expect(link.id).toBeDefined();
      expect(link.displayText).toBe('UserService Class');
      expect((link.target as SymbolLocation).symbolName).toBe('UserService');
    });

    it('should generate display text if not provided', async () => {
      const target: SymbolLocation = {
        symbolName: 'getUser',
        kind: 'function',
        filePath: 'src/api.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 5, column: 0 } },
      };

      const link = await linker.createLink('page-3', target);

      expect(link.displayText).toContain('getUser');
    });
  });

  describe('resolveLink', () => {
    it('should resolve a file link', async () => {
      const target: FileLocation = {
        filePath: 'src/index.ts',
      };

      const link = await linker.createLink('page-1', target);
      const resolved = await linker.resolveLink(link);

      expect(resolved.type).toBe('file');
      expect(resolved.filePath).toContain('index.ts');
    });

    it('should resolve a symbol link', async () => {
      const target: SymbolLocation = {
        symbolName: 'MyClass',
        kind: 'class',
        filePath: 'src/my-class.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
      };

      const link = await linker.createLink('page-2', target);
      const resolved = await linker.resolveLink(link);

      expect(resolved.type).toBe('symbol');
      expect(resolved.symbolName).toBe('MyClass');
      expect(resolved.symbolKind).toBe('class');
    });
  });

  describe('getLinksByPage', () => {
    it('should return links for a page', async () => {
      await linker.createLink('page-1', { filePath: 'file1.ts' });
      await linker.createLink('page-1', { filePath: 'file2.ts' });
      await linker.createLink('page-2', { filePath: 'file3.ts' });

      const links = await linker.getLinksByPage('page-1');

      expect(links.length).toBe(2);
    });
  });

  describe('getLinksByFile', () => {
    it('should return links for a file', async () => {
      await linker.createLink('page-1', { filePath: 'src/common.ts' });
      await linker.createLink('page-2', { filePath: 'src/common.ts' });
      await linker.createLink('page-3', { filePath: 'src/other.ts' });

      const links = await linker.getLinksByFile('src/common.ts');

      expect(links.length).toBe(2);
    });
  });

  describe('getLinksBySymbol', () => {
    it('should return links for a symbol', async () => {
      const target: SymbolLocation = {
        symbolName: 'SharedClass',
        kind: 'class',
        filePath: 'src/shared.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
      };

      await linker.createLink('page-1', target);
      await linker.createLink('page-2', target);

      const links = await linker.getLinksBySymbol('SharedClass');

      expect(links.length).toBe(2);
    });
  });

  describe('removeLink', () => {
    it('should remove a link', async () => {
      const link = await linker.createLink('page-1', { filePath: 'file.ts' });
      const result = await linker.removeLink(link.id);

      expect(result).toBe(true);

      const links = await linker.getLinksByPage('page-1');
      expect(links.length).toBe(0);
    });

    it('should return false for non-existent link', async () => {
      const result = await linker.removeLink('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('updateLinks', () => {
    it('should replace all links for a page', async () => {
      await linker.createLink('page-1', { filePath: 'old-file.ts' });

      const newLinks = [
        {
          id: 'new-1',
          pageId: 'page-1',
          target: { filePath: 'new-file-1.ts' } as FileLocation,
          displayText: 'New File 1',
          createdAt: new Date(),
        },
        {
          id: 'new-2',
          pageId: 'page-1',
          target: { filePath: 'new-file-2.ts' } as FileLocation,
          displayText: 'New File 2',
          createdAt: new Date(),
        },
      ];

      await linker.updateLinks('page-1', newLinks);

      const links = await linker.getLinksByPage('page-1');
      expect(links.length).toBe(2);
    });
  });
});

describe('SymbolTracker', () => {
  let tracker: SymbolTracker;
  const testProjectPath = '/test/project';

  const mockParsedFiles: ParsedFile[] = [
    {
      path: 'src/services/user.ts',
      language: Language.TypeScript,
      symbols: [
        { name: 'UserService', kind: SymbolKind.Class, description: '', location: { file: 'src/services/user.ts', line: 1 } },
        { name: 'getUser', kind: SymbolKind.Function, description: '', location: { file: 'src/services/user.ts', line: 20 } },
      ],
      imports: [],
      exports: [],
    },
    {
      path: 'src/models/user.ts',
      language: Language.TypeScript,
      symbols: [
        { name: 'User', kind: SymbolKind.Interface, description: '', location: { file: 'src/models/user.ts', line: 1 } },
        { name: 'UserRole', kind: SymbolKind.Enum, description: '', location: { file: 'src/models/user.ts', line: 15 } },
      ],
      imports: [],
      exports: [],
    },
  ];

  beforeEach(() => {
    tracker = new SymbolTracker(testProjectPath);
    tracker.loadParsedFiles(mockParsedFiles);
  });

  describe('trackSymbol', () => {
    it('should find a symbol by name and file', async () => {
      const location = await tracker.trackSymbol('UserService', 'src/services/user.ts');

      expect(location).not.toBeNull();
      expect(location?.symbolName).toBe('UserService');
      expect(location?.kind).toBe('class');
    });

    it('should return null for non-existent symbol', async () => {
      const location = await tracker.trackSymbol('NonExistent', 'src/services/user.ts');

      expect(location).toBeNull();
    });
  });

  describe('findUsages', () => {
    it('should find all usages of a symbol', async () => {
      const usages = await tracker.findUsages('UserService');

      expect(usages.length).toBeGreaterThan(0);
      expect(usages[0].symbolName).toBe('UserService');
    });
  });

  describe('getDefinition', () => {
    it('should get the definition of a symbol', async () => {
      const definition = await tracker.getDefinition('UserService');

      expect(definition).not.toBeNull();
      expect(definition?.kind).toBe('class');
    });

    it('should return null for non-existent symbol', async () => {
      const definition = await tracker.getDefinition('NonExistent');

      expect(definition).toBeNull();
    });
  });

  describe('getSymbolsByFile', () => {
    it('should return all symbols in a file', () => {
      const symbols = tracker.getSymbolsByFile('src/services/user.ts');

      expect(symbols.length).toBe(2);
      expect(symbols.some((s) => s.symbolName === 'UserService')).toBe(true);
      expect(symbols.some((s) => s.symbolName === 'getUser')).toBe(true);
    });
  });

  describe('getSymbolNames', () => {
    it('should return all symbol names', () => {
      const names = tracker.getSymbolNames();

      expect(names.length).toBe(4);
      expect(names).toContain('UserService');
      expect(names).toContain('User');
    });
  });
});

describe('LocationIndex', () => {
  let index: LocationIndex;

  beforeEach(() => {
    index = new LocationIndex();
  });

  describe('indexLocation', () => {
    it('should index a file location', async () => {
      const location: FileLocation = {
        filePath: 'src/index.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
      };

      await index.indexLocation(location, 'link-1');

      const result = await index.queryByLocation('src/index.ts');
      expect(result).toContain('link-1');
    });

    it('should index a symbol location', async () => {
      const location: SymbolLocation = {
        symbolName: 'MyClass',
        kind: 'class',
        filePath: 'src/my-class.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
      };

      await index.indexLocation(location, 'link-2');

      const result = await index.queryBySymbol('MyClass');
      expect(result).toContain('link-2');
    });
  });

  describe('removeLocation', () => {
    it('should remove an indexed location', async () => {
      const location: FileLocation = { filePath: 'src/test.ts' };
      await index.indexLocation(location, 'link-3');

      await index.removeLocation('link-3');

      const result = await index.queryByLocation('src/test.ts');
      expect(result).not.toContain('link-3');
    });
  });

  describe('queryByPage', () => {
    it('should return links for a page', async () => {
      const location: FileLocation = { filePath: 'src/test.ts' };
      await index.indexLocation(location, 'link-4');
      index.indexByPage('page-1', 'link-4');

      const result = await index.queryByPage('page-1');
      expect(result).toContain('link-4');
    });
  });

  describe('getStats', () => {
    it('should return index statistics', async () => {
      await index.indexLocation({ filePath: 'src/a.ts' }, 'link-1');
      await index.indexLocation({ filePath: 'src/b.ts' }, 'link-2');
      index.indexByPage('page-1', 'link-1');

      const stats = index.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.fileCount).toBe(2);
      expect(stats.pageCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await index.indexLocation({ filePath: 'src/test.ts' }, 'link-1');
      index.clear();

      const stats = index.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
