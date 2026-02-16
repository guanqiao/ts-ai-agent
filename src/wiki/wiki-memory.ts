import * as path from 'path';
import * as fs from 'fs';
import { ParsedFile } from '../types';
import {
  IWikiMemory,
  CodingPattern,
  ProjectConvention,
} from './types';

export class WikiMemory implements IWikiMemory {
  private patterns: Map<string, CodingPattern> = new Map();
  private conventions: Map<string, ProjectConvention> = new Map();
  private storagePath: string;

  constructor(projectPath: string) {
    this.storagePath = path.join(projectPath, '.wiki', 'memory');
    this.loadFromDisk();
  }

  async learnPattern(pattern: CodingPattern): Promise<void> {
    const key = `${pattern.type}:${pattern.pattern}`;
    const existing = this.patterns.get(key);

    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date();
      if (!existing.examples.includes(pattern.examples[0])) {
        existing.examples.push(...pattern.examples.slice(0, 3));
        if (existing.examples.length > 10) {
          existing.examples = existing.examples.slice(-10);
        }
      }
    } else {
      this.patterns.set(key, {
        ...pattern,
        frequency: 1,
        lastSeen: new Date(),
      });
    }

    await this.saveToDisk();
  }

  async getPatterns(type?: CodingPattern['type']): Promise<CodingPattern[]> {
    const allPatterns = Array.from(this.patterns.values());

    if (type) {
      return allPatterns.filter((p) => p.type === type);
    }

    return allPatterns.sort((a, b) => b.frequency - a.frequency);
  }

  async discoverConventions(parsedFiles: ParsedFile[]): Promise<ProjectConvention[]> {
    const conventions: ProjectConvention[] = [];

    const namingConvention = await this.discoverNamingConvention(parsedFiles);
    if (namingConvention) {
      conventions.push(namingConvention);
    }

    const importConvention = await this.discoverImportConvention(parsedFiles);
    if (importConvention) {
      conventions.push(importConvention);
    }

    const commentConvention = await this.discoverCommentConvention(parsedFiles);
    if (commentConvention) {
      conventions.push(commentConvention);
    }

    const structureConvention = await this.discoverStructureConvention(parsedFiles);
    if (structureConvention) {
      conventions.push(structureConvention);
    }

    for (const convention of conventions) {
      this.conventions.set(convention.id, convention);
    }

    await this.saveToDisk();

    return conventions;
  }

  async getConventions(): Promise<ProjectConvention[]> {
    return Array.from(this.conventions.values());
  }

  applyConventions(code: string): string {
    let result = code;

    for (const convention of this.conventions.values()) {
      result = this.applyConvention(result, convention);
    }

    return result;
  }

  async clear(): Promise<void> {
    this.patterns.clear();
    this.conventions.clear();
    await this.saveToDisk();
  }

  private async discoverNamingConvention(parsedFiles: ParsedFile[]): Promise<ProjectConvention | null> {
    const namingPatterns: Map<string, number> = new Map();

    for (const file of parsedFiles) {
      for (const symbol of file.symbols) {
        const pattern = this.detectNamingPattern(symbol.name);
        namingPatterns.set(pattern, (namingPatterns.get(pattern) || 0) + 1);
      }
    }

    if (namingPatterns.size === 0) return null;

    const sortedPatterns = Array.from(namingPatterns.entries()).sort((a, b) => b[1] - a[1]);
    const dominantPattern = sortedPatterns[0];

    if (dominantPattern[1] < 5) return null;

    return {
      id: 'naming-convention',
      name: 'Naming Convention',
      description: `Project uses ${dominantPattern[0]} naming convention`,
      patterns: [
        {
          type: 'naming',
          pattern: dominantPattern[0],
          examples: this.getNamingExamples(parsedFiles, dominantPattern[0]),
          frequency: dominantPattern[1],
          lastSeen: new Date(),
        },
      ],
      examples: this.getNamingExamples(parsedFiles, dominantPattern[0]).slice(0, 5),
      confidence: dominantPattern[1] / parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0),
      discoveredAt: new Date(),
    };
  }

  private async discoverImportConvention(parsedFiles: ParsedFile[]): Promise<ProjectConvention | null> {
    const importStyles: Map<string, number> = new Map();
    const examples: string[] = [];

    for (const file of parsedFiles) {
      const content = file.rawContent || '';
      const importMatches = content.match(/import\s+.*?from\s+['"].*?['"]/g) || [];

      for (const imp of importMatches) {
        examples.push(imp);
        if (imp.includes('{')) {
          importStyles.set('named', (importStyles.get('named') || 0) + 1);
        } else {
          importStyles.set('default', (importStyles.get('default') || 0) + 1);
        }
      }
    }

    if (importStyles.size === 0) return null;

    const sortedStyles = Array.from(importStyles.entries()).sort((a, b) => b[1] - a[1]);
    const dominantStyle = sortedStyles[0];

    return {
      id: 'import-convention',
      name: 'Import Convention',
      description: `Project prefers ${dominantStyle[0]} imports`,
      patterns: [
        {
          type: 'import',
          pattern: dominantStyle[0],
          examples: examples.slice(0, 5),
          frequency: dominantStyle[1],
          lastSeen: new Date(),
        },
      ],
      examples: examples.slice(0, 5),
      confidence: dominantStyle[1] / ((importStyles.get('named') || 0) + (importStyles.get('default') || 0)),
      discoveredAt: new Date(),
    };
  }

  private async discoverCommentConvention(parsedFiles: ParsedFile[]): Promise<ProjectConvention | null> {
    const commentStyles: Map<string, number> = new Map();
    const examples: string[] = [];

    for (const file of parsedFiles) {
      const content = file.rawContent || '';

      const jsDocMatches = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
      if (jsDocMatches.length > 0) {
        commentStyles.set('jsdoc', (commentStyles.get('jsdoc') || 0) + jsDocMatches.length);
        examples.push(...jsDocMatches.slice(0, 3));
      }

      const singleLineMatches = content.match(/\/\/.*$/gm) || [];
      if (singleLineMatches.length > 0) {
        commentStyles.set('single-line', (commentStyles.get('single-line') || 0) + singleLineMatches.length);
        examples.push(...singleLineMatches.slice(0, 3));
      }
    }

    if (commentStyles.size === 0) return null;

    const sortedStyles = Array.from(commentStyles.entries()).sort((a, b) => b[1] - a[1]);
    const dominantStyle = sortedStyles[0];

    return {
      id: 'comment-convention',
      name: 'Comment Convention',
      description: `Project uses ${dominantStyle[0]} comments`,
      patterns: [
        {
          type: 'comment',
          pattern: dominantStyle[0],
          examples: examples.slice(0, 5),
          frequency: dominantStyle[1],
          lastSeen: new Date(),
        },
      ],
      examples: examples.slice(0, 5),
      confidence: 0.7,
      discoveredAt: new Date(),
    };
  }

  private async discoverStructureConvention(parsedFiles: ParsedFile[]): Promise<ProjectConvention | null> {
    const structures: Map<string, number> = new Map();
    const examples: string[] = [];

    for (const file of parsedFiles) {
      const hasClass = file.symbols.some((s) => s.kind === 'class');
      const hasInterface = file.symbols.some((s) => s.kind === 'interface');
      const hasFunction = file.symbols.some((s) => s.kind === 'function');

      let structure = '';
      if (hasInterface) structure += 'interface:';
      if (hasClass) structure += 'class:';
      if (hasFunction) structure += 'function';

      if (structure) {
        structures.set(structure, (structures.get(structure) || 0) + 1);
        examples.push(`${file.path}: ${structure}`);
      }
    }

    if (structures.size === 0) return null;

    const sortedStructures = Array.from(structures.entries()).sort((a, b) => b[1] - a[1]);
    const dominantStructure = sortedStructures[0];

    return {
      id: 'structure-convention',
      name: 'File Structure Convention',
      description: `Common file structure: ${dominantStructure[0]}`,
      patterns: [
        {
          type: 'structure',
          pattern: dominantStructure[0],
          examples: examples.slice(0, 5),
          frequency: dominantStructure[1],
          lastSeen: new Date(),
        },
      ],
      examples: examples.slice(0, 5),
      confidence: dominantStructure[1] / parsedFiles.length,
      discoveredAt: new Date(),
    };
  }

  private detectNamingPattern(name: string): string {
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(name)) return 'PascalCase';
    if (/^[a-z]+(?:[A-Z][a-z]+)*$/.test(name)) return 'camelCase';
    if (/^[a-z]+(?:_[a-z]+)*$/.test(name)) return 'snake_case';
    if (/^[A-Z]+(?:_[A-Z]+)*$/.test(name)) return 'UPPER_SNAKE_CASE';
    if (/^[a-z]+(?:-[a-z]+)*$/.test(name)) return 'kebab-case';
    return 'unknown';
  }

  private getNamingExamples(parsedFiles: ParsedFile[], pattern: string): string[] {
    const examples: string[] = [];

    for (const file of parsedFiles) {
      for (const symbol of file.symbols) {
        if (this.detectNamingPattern(symbol.name) === pattern) {
          examples.push(symbol.name);
          if (examples.length >= 10) return examples;
        }
      }
    }

    return examples;
  }

  private applyConvention(code: string, convention: ProjectConvention): string {
    switch (convention.id) {
      case 'naming-convention':
        return code;

      case 'import-convention':
        return code;

      case 'comment-convention':
        return code;

      default:
        return code;
    }
  }

  private async saveToDisk(): Promise<void> {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    const patternsPath = path.join(this.storagePath, 'patterns.json');
    const conventionsPath = path.join(this.storagePath, 'conventions.json');

    const patternsObj: Record<string, CodingPattern> = {};
    for (const [key, pattern] of this.patterns) {
      patternsObj[key] = pattern;
    }

    const conventionsObj: Record<string, ProjectConvention> = {};
    for (const [key, convention] of this.conventions) {
      conventionsObj[key] = convention;
    }

    fs.writeFileSync(patternsPath, JSON.stringify(patternsObj, null, 2));
    fs.writeFileSync(conventionsPath, JSON.stringify(conventionsObj, null, 2));
  }

  private loadFromDisk(): void {
    const patternsPath = path.join(this.storagePath, 'patterns.json');
    const conventionsPath = path.join(this.storagePath, 'conventions.json');

    if (fs.existsSync(patternsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        for (const [key, pattern] of Object.entries(data)) {
          this.patterns.set(key, pattern as CodingPattern);
        }
      } catch {
        // Ignore parsing errors
      }
    }

    if (fs.existsSync(conventionsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(conventionsPath, 'utf-8'));
        for (const [key, convention] of Object.entries(data)) {
          this.conventions.set(key, convention as ProjectConvention);
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  getPatternCount(): number {
    return this.patterns.size;
  }

  getConventionCount(): number {
    return this.conventions.size;
  }
}
