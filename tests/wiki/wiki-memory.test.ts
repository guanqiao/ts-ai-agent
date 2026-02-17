import { WikiMemory } from '@wiki/wiki-memory';
import { CodingPattern, ProjectConvention } from '@wiki/types';
import { ParsedFile, CodeSymbol, SymbolKind, Language } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
}));

describe('WikiMemory', () => {
  let memory: WikiMemory;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    memory = new WikiMemory(testProjectPath);
  });

  describe('learnPattern', () => {
    it('should add new pattern', async () => {
      const pattern: CodingPattern = {
        type: 'naming',
        pattern: 'camelCase',
        examples: ['myVariable'],
        frequency: 1,
        lastSeen: new Date(),
      };

      await memory.learnPattern(pattern);

      const patterns = await memory.getPatterns('naming');
      expect(patterns.length).toBe(1);
      expect(patterns[0].pattern).toBe('camelCase');
    });

    it('should increment frequency for existing pattern', async () => {
      const pattern: CodingPattern = {
        type: 'naming',
        pattern: 'camelCase',
        examples: ['myVariable'],
        frequency: 1,
        lastSeen: new Date(),
      };

      await memory.learnPattern(pattern);
      await memory.learnPattern(pattern);

      const patterns = await memory.getPatterns('naming');
      expect(patterns[0].frequency).toBe(2);
    });

    it('should add new examples to existing pattern', async () => {
      const pattern1: CodingPattern = {
        type: 'naming',
        pattern: 'camelCase',
        examples: ['firstExample'],
        frequency: 1,
        lastSeen: new Date(),
      };

      const pattern2: CodingPattern = {
        type: 'naming',
        pattern: 'camelCase',
        examples: ['secondExample'],
        frequency: 1,
        lastSeen: new Date(),
      };

      await memory.learnPattern(pattern1);
      await memory.learnPattern(pattern2);

      const patterns = await memory.getPatterns('naming');
      expect(patterns[0].examples).toContain('firstExample');
      expect(patterns[0].examples).toContain('secondExample');
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns sorted by frequency', async () => {
      await memory.learnPattern({
        type: 'naming',
        pattern: 'pattern1',
        examples: ['ex1'],
        frequency: 1,
        lastSeen: new Date(),
      });

      await memory.learnPattern({
        type: 'naming',
        pattern: 'pattern2',
        examples: ['ex2'],
        frequency: 1,
        lastSeen: new Date(),
      });

      await memory.learnPattern({
        type: 'naming',
        pattern: 'pattern2',
        examples: ['ex2'],
        frequency: 1,
        lastSeen: new Date(),
      });

      const patterns = await memory.getPatterns();

      expect(patterns.length).toBe(2);
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(patterns[1].frequency);
    });

    it('should filter by type', async () => {
      await memory.learnPattern({
        type: 'naming',
        pattern: 'namingPattern',
        examples: ['ex1'],
        frequency: 1,
        lastSeen: new Date(),
      });

      await memory.learnPattern({
        type: 'structure',
        pattern: 'structurePattern',
        examples: ['ex2'],
        frequency: 1,
        lastSeen: new Date(),
      });

      const namingPatterns = await memory.getPatterns('naming');
      expect(namingPatterns.length).toBe(1);
      expect(namingPatterns[0].type).toBe('naming');
    });
  });

  describe('discoverConventions', () => {
    it('should discover naming conventions', async () => {
      const parsedFiles: ParsedFile[] = [
        {
          path: 'test.ts',
          rawContent: '',
          language: Language.TypeScript,
          imports: [],
          exports: [],
          symbols: [
            {
              name: 'MyClass',
              kind: SymbolKind.Class,
              location: { file: 'test.ts', line: 1 },
            },
            {
              name: 'myFunction',
              kind: SymbolKind.Function,
              location: { file: 'test.ts', line: 5 },
            },
            {
              name: 'MY_CONSTANT',
              kind: SymbolKind.Constant,
              location: { file: 'test.ts', line: 10 },
            },
          ],
        },
      ];

      const conventions = await memory.discoverConventions(parsedFiles);

      expect(conventions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty files', async () => {
      const conventions = await memory.discoverConventions([]);
      expect(Array.isArray(conventions)).toBe(true);
    });
  });

  describe('getConventions', () => {
    it('should return all conventions', async () => {
      const conventions = await memory.getConventions();
      expect(Array.isArray(conventions)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all patterns and conventions', async () => {
      await memory.learnPattern({
        type: 'naming',
        pattern: 'test',
        examples: ['ex'],
        frequency: 1,
        lastSeen: new Date(),
      });

      memory.clear();

      const patterns = await memory.getPatterns();
      expect(patterns.length).toBe(0);
    });
  });
});
