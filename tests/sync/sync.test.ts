import { ChangeDetector } from '../../src/sync/change-detector';
import { IncrementalUpdater } from '../../src/sync/incremental-updater';
import { ParsedFile, SymbolKind, Language } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('ChangeDetector', () => {
  let detector: ChangeDetector;

  beforeEach(() => {
    detector = new ChangeDetector();
  });

  describe('detect', () => {
    it('should detect changes between old and new files', () => {
      const oldFiles: ParsedFile[] = [
        {
          path: '/src/old.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'OldClass',
              kind: SymbolKind.Class,
              location: { file: '/src/old.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
      ];

      const newFiles: ParsedFile[] = [
        {
          path: '/src/new.ts',
          language: Language.TypeScript,
          symbols: [
            {
              name: 'NewClass',
              kind: SymbolKind.Class,
              location: { file: '/src/new.ts', line: 1 },
            },
          ],
          imports: [],
          exports: [],
        },
      ];

      const changeSet = detector.detect(oldFiles, newFiles);

      expect(changeSet).toBeDefined();
      expect(changeSet.files.length).toBeGreaterThan(0);
      expect(changeSet.summary).toBeDefined();
      expect(changeSet.timestamp).toBeInstanceOf(Date);
    });

    it('should return empty changeset for identical files', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/same.ts',
          language: Language.TypeScript,
          symbols: [],
          imports: [],
          exports: [],
        },
      ];

      const changeSet = detector.detect(files, files);

      expect(changeSet.files.length).toBe(0);
    });
  });

  describe('detectFileChange', () => {
    it('should detect added file', () => {
      const newFile: ParsedFile = {
        path: '/src/new.ts',
        language: Language.TypeScript,
        symbols: [],
        imports: [],
        exports: [],
      };

      const change = detector.detectFileChange(null, newFile);

      expect(change).toBeDefined();
      expect(change?.changeType).toBe('added');
    });

    it('should detect deleted file', () => {
      const oldFile: ParsedFile = {
        path: '/src/old.ts',
        language: Language.TypeScript,
        symbols: [],
        imports: [],
        exports: [],
      };

      const change = detector.detectFileChange(oldFile, null);

      expect(change).toBeDefined();
      expect(change?.changeType).toBe('deleted');
    });

    it('should return null for unchanged files', () => {
      const file: ParsedFile = {
        path: '/src/same.ts',
        language: Language.TypeScript,
        symbols: [],
        imports: [],
        exports: [],
        rawContent: 'same content',
      };

      const change = detector.detectFileChange(file, file);

      expect(change).toBeNull();
    });
  });

  describe('compareSymbols', () => {
    it('should detect added symbols', () => {
      const oldSymbols = [
        { name: 'Old', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
      ];

      const newSymbols = [
        { name: 'Old', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
        { name: 'New', kind: SymbolKind.Class, location: { file: 'test.ts', line: 10 } },
      ];

      const result = detector.compareSymbols(oldSymbols, newSymbols);

      expect(result.added.length).toBe(1);
      expect(result.added[0].name).toBe('New');
    });

    it('should detect deleted symbols', () => {
      const oldSymbols = [
        { name: 'Old', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
        { name: 'Deleted', kind: SymbolKind.Class, location: { file: 'test.ts', line: 10 } },
      ];

      const newSymbols = [
        { name: 'Old', kind: SymbolKind.Class, location: { file: 'test.ts', line: 1 } },
      ];

      const result = detector.compareSymbols(oldSymbols, newSymbols);

      expect(result.deleted.length).toBe(1);
      expect(result.deleted[0].name).toBe('Deleted');
    });
  });
});

describe('IncrementalUpdater', () => {
  let updater: IncrementalUpdater;
  const testSnapshotDir = path.join(__dirname, 'test-snapshots');

  beforeEach(() => {
    updater = new IncrementalUpdater(testSnapshotDir, 5);
  });

  afterEach(() => {
    if (fs.existsSync(testSnapshotDir)) {
      fs.rmSync(testSnapshotDir, { recursive: true, force: true });
    }
  });

  describe('update', () => {
    it('should return unchanged document for empty changeset', async () => {
      const document = '# Test Document\n\nContent here.';
      const changeSet = {
        files: [],
        timestamp: new Date(),
        baseCommit: '',
        headCommit: '',
        summary: {
          totalFiles: 0,
          addedFiles: 0,
          modifiedFiles: 0,
          deletedFiles: 0,
          renamedFiles: 0,
          totalSymbols: 0,
          addedSymbols: 0,
          modifiedSymbols: 0,
          deletedSymbols: 0,
        },
      };

      const result = await updater.update(changeSet, document);

      expect(result).toBe(document);
    });
  });

  describe('mergeContent', () => {
    it('should merge added content', () => {
      const oldContent = '# Old\n\nOld content.';
      const newContent = '## New Section\n\nNew content.';

      const result = updater.mergeContent(oldContent, newContent, 'added');

      expect(result).toContain('Old content');
    });

    it('should merge modified content', () => {
      const oldContent = '# Title\n\nOld content.';
      const newContent = '# Title\n\nNew content.';

      const result = updater.mergeContent(oldContent, newContent, 'modified');

      expect(result).toBeDefined();
    });

    it('should handle deleted content', () => {
      const oldContent = '# Title\n\nContent to delete.';
      const newContent = '';

      const result = updater.mergeContent(oldContent, newContent, 'deleted');

      expect(result).toBeDefined();
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot from parsed files', () => {
      const files: ParsedFile[] = [
        {
          path: '/src/test.ts',
          language: Language.TypeScript,
          symbols: [
            { name: 'TestClass', kind: SymbolKind.Class, location: { file: '/src/test.ts', line: 1 } },
          ],
          imports: [],
          exports: [],
        },
      ];

      const snapshot = updater.createSnapshot(files, 'abc123');

      expect(snapshot).toBeDefined();
      expect(snapshot.commitHash).toBe('abc123');
      expect(snapshot.files.length).toBe(1);
      expect(snapshot.metadata.totalFiles).toBe(1);
      expect(snapshot.metadata.totalSymbols).toBe(1);
    });
  });

  describe('saveSnapshot and loadSnapshot', () => {
    it('should save and load a snapshot', async () => {
      const files: ParsedFile[] = [
        {
          path: '/src/test.ts',
          language: Language.TypeScript,
          symbols: [],
          imports: [],
          exports: [],
        },
      ];

      const snapshot = updater.createSnapshot(files, 'test-commit');
      await updater.saveSnapshot(snapshot);

      const loaded = await updater.loadSnapshot(snapshot.id);

      expect(loaded).toBeDefined();
      expect(loaded?.commitHash).toBe('test-commit');
      expect(loaded?.files.length).toBe(1);
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await updater.loadSnapshot('non-existent');

      expect(loaded).toBeNull();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return null when no snapshots exist', async () => {
      const latest = await updater.getLatestSnapshot();

      expect(latest).toBeNull();
    });

    it('should return the most recent snapshot', async () => {
      const files: ParsedFile[] = [];

      const snapshot1 = updater.createSnapshot(files, 'commit1');
      await updater.saveSnapshot(snapshot1);

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot2 = updater.createSnapshot(files, 'commit2');
      await updater.saveSnapshot(snapshot2);

      const latest = await updater.getLatestSnapshot();

      expect(latest).toBeDefined();
      expect(latest?.commitHash).toBe('commit2');
    });
  });
});
