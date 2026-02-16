import { BaseParser } from './base';
import {
  ParsedFile,
  ParseResult,
  ParserOptions,
  CodeSymbol,
  SymbolKind,
  ImportInfo,
  ExportInfo,
  Language,
} from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

interface JavaClassOrInterface {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'annotation';
  modifiers: string[];
  generics: string[];
  extends?: string;
  implements: string[];
  fields: JavaField[];
  methods: JavaMethod[];
  constructors: JavaConstructor[];
  annotations: JavaAnnotation[];
  javadoc?: string;
  location: { startLine: number; endLine: number };
}

interface JavaField {
  name: string;
  type: string;
  modifiers: string[];
  annotations: JavaAnnotation[];
  javadoc?: string;
}

interface JavaMethod {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  modifiers: string[];
  generics: string[];
  annotations: JavaAnnotation[];
  javadoc?: string;
  location: { startLine: number; endLine: number };
}

interface JavaConstructor {
  name: string;
  parameters: { name: string; type: string }[];
  modifiers: string[];
  annotations: JavaAnnotation[];
  javadoc?: string;
}

interface JavaAnnotation {
  name: string;
  values: string[];
}

function parseJavaCode(content: string): any {
  const lines = content.split('\n');
  const classes: JavaClassOrInterface[] = [];
  const classRegex =
    /(?:public|private|protected)?\s*(?:abstract|final)?\s*(class|interface|enum)\s+(\w+)/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const kind = match[1];
    const name = match[2];
    const startLine = content.substring(0, match.index).split('\n').length;

    const classInfo: JavaClassOrInterface = {
      name,
      kind: kind as 'class' | 'interface' | 'enum',
      modifiers: [],
      generics: [],
      extends: undefined,
      implements: [],
      fields: [],
      methods: [],
      constructors: [],
      annotations: [],
      javadoc: extractJavadoc(lines, startLine),
      location: { startLine, endLine: lines.length },
    };

    const classStart = match.index;
    let braceCount = 0;
    let classEnd = classStart;
    let foundOpen = false;

    for (let i = classStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundOpen = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    classInfo.location.endLine = content.substring(0, classEnd).split('\n').length;

    const classBody = content.substring(classStart, classEnd);
    extractClassMembers(classBody, classInfo);

    classes.push(classInfo);
  }

  return { types: classes };
}

function extractJavadoc(lines: string[], startLine: number): string | undefined {
  const javadocLines: string[] = [];
  let i = startLine - 2;

  while (i >= 0 && !lines[i].trim().startsWith('/**')) {
    i--;
  }

  if (i < 0) return undefined;

  for (let j = i; j < startLine - 1; j++) {
    const line = lines[j].trim();
    if (line.startsWith('*') && !line.startsWith('/**') && !line.startsWith('*/')) {
      javadocLines.push(line.substring(1).trim());
    } else if (line.startsWith('/**')) {
      const content = line.substring(3).replace(/\*\/$/, '').trim();
      if (content) javadocLines.push(content);
    }
  }

  return javadocLines.length > 0 ? javadocLines.join('\n') : undefined;
}

function extractClassMembers(classBody: string, classInfo: JavaClassOrInterface): void {
  const fieldRegex =
    /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/g;
  let fieldMatch;

  while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
    classInfo.fields.push({
      name: fieldMatch[2],
      type: fieldMatch[1],
      modifiers: [],
      annotations: [],
    });
  }

  const methodRegex =
    /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
  let methodMatch;

  while ((methodMatch = methodRegex.exec(classBody)) !== null) {
    const returnType = methodMatch[1];
    const methodName = methodMatch[2];

    if (methodName === classInfo.name) {
      classInfo.constructors.push({
        name: methodName,
        parameters: parseParameters(methodMatch[3]),
        modifiers: [],
        annotations: [],
      });
    } else if (returnType !== 'class' && returnType !== 'interface' && returnType !== 'enum') {
      classInfo.methods.push({
        name: methodName,
        returnType,
        parameters: parseParameters(methodMatch[3]),
        modifiers: [],
        generics: [],
        annotations: [],
        location: { startLine: 1, endLine: 1 },
      });
    }
  }
}

function parseParameters(paramsStr: string): { name: string; type: string }[] {
  if (!paramsStr.trim()) return [];

  return paramsStr.split(',').map((param) => {
    const parts = param.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { type: parts[0], name: parts[parts.length - 1] };
    }
    return { type: 'Object', name: parts[0] || 'param' };
  });
}

export class JavaParser extends BaseParser {
  readonly language = Language.Java;

  isSupported(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return ext === '.java';
  }

  async parse(filePath: string, options?: ParserOptions): Promise<ParsedFile> {
    const startTime = Date.now();
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const symbols = this.parseJavaContent(content, absolutePath, options);
    const imports = this.extractImports(content);
    const exports = this.extractExports(symbols);

    return {
      path: absolutePath,
      language: this.language,
      symbols,
      imports,
      exports,
      rawContent: content,
      parseTime: Date.now() - startTime,
    };
  }

  async parseDirectory(dirPath: string, options?: ParserOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const result = this.createEmptyResult();
    const absoluteDir = path.resolve(dirPath);

    const patterns = options?.includePatterns?.length
      ? options.includePatterns.map((p) => path.join(absoluteDir, p))
      : [path.join(absoluteDir, '**/*.java')];

    const excludePatterns = options?.excludePatterns || ['target/**', 'build/**', 'out/**'];

    const files = await glob(patterns, {
      ignore: excludePatterns,
      absolute: true,
      nodir: true,
    });

    for (const file of files) {
      if (this.shouldExclude(file, options) || !this.shouldInclude(file, options)) {
        continue;
      }

      try {
        const parsedFile = await this.parse(file, options);
        result.files.push(parsedFile);
        result.summary.totalSymbols += parsedFile.symbols.length;
      } catch (error) {
        result.errors.push({
          file,
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
        });
      }
    }

    result.summary.totalFiles = result.files.length;
    result.summary.parseTime = Date.now() - startTime;
    this.calculateSummaryStats(result);

    return result;
  }

  private parseJavaContent(
    content: string,
    filePath: string,
    options?: ParserOptions
  ): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];

    try {
      const ast = parseJavaCode(content);
      const classes = ast.types || [];

      for (const cls of classes) {
        if (!this.shouldSkipJavaSymbol(cls, options)) {
          symbols.push(this.convertClassToSymbol(cls, filePath));
        }
      }
    } catch {
      this.fallbackParse(content, filePath).forEach((s) => symbols.push(s));
    }

    return symbols;
  }

  private shouldSkipJavaSymbol(cls: JavaClassOrInterface, options?: ParserOptions): boolean {
    if (options?.includePrivate) return false;
    return cls.modifiers.includes('private') || cls.modifiers.includes('protected');
  }

  private convertClassToSymbol(cls: JavaClassOrInterface, filePath: string): CodeSymbol {
    const symbol: CodeSymbol = {
      name: cls.name,
      kind: this.mapJavaKindToSymbolKind(cls.kind),
      location: {
        file: filePath,
        line: cls.location.startLine,
        endLine: cls.location.endLine,
      },
      description: cls.javadoc,
      documentation: cls.javadoc,
      modifiers: cls.modifiers,
      decorators: cls.annotations.map((a) => ({
        name: a.name,
        arguments: a.values,
      })),
      generics: cls.generics.map((g) => ({ name: g })),
      extends: cls.extends ? [cls.extends] : undefined,
      implements: cls.implements.length > 0 ? cls.implements : undefined,
      members: [],
    };

    for (const field of cls.fields) {
      symbol.members!.push({
        name: field.name,
        kind: SymbolKind.Field,
        location: { file: filePath, line: 1 },
        type: field.type,
        modifiers: field.modifiers,
        decorators: field.annotations.map((a) => ({ name: a.name, arguments: a.values })),
        description: field.javadoc,
      });
    }

    for (const method of cls.methods) {
      symbol.members!.push({
        name: method.name,
        kind: SymbolKind.Method,
        location: {
          file: filePath,
          line: method.location.startLine,
          endLine: method.location.endLine,
        },
        returnType: method.returnType,
        parameters: method.parameters.map((p) => ({
          name: p.name,
          type: p.type,
        })),
        modifiers: method.modifiers,
        decorators: method.annotations.map((a) => ({ name: a.name, arguments: a.values })),
        description: method.javadoc,
      });
    }

    for (const ctor of cls.constructors) {
      symbol.members!.push({
        name: ctor.name,
        kind: SymbolKind.Constructor,
        location: { file: filePath, line: 1 },
        parameters: ctor.parameters.map((p) => ({
          name: p.name,
          type: p.type,
        })),
        modifiers: ctor.modifiers,
        decorators: ctor.annotations.map((a) => ({ name: a.name, arguments: a.values })),
        description: ctor.javadoc,
      });
    }

    return symbol;
  }

  private mapJavaKindToSymbolKind(kind: string): SymbolKind {
    switch (kind) {
      case 'class':
        return SymbolKind.Class;
      case 'interface':
        return SymbolKind.Interface;
      case 'enum':
        return SymbolKind.Enum;
      case 'annotation':
        return SymbolKind.Annotation;
      default:
        return SymbolKind.Class;
    }
  }

  private fallbackParse(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const classRegex =
      /(?:public|private|protected)?\s*(?:abstract|final)?\s*(class|interface|enum)\s+(\w+)/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const kind = match[1];
      const name = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      symbols.push({
        name,
        kind:
          kind === 'class'
            ? SymbolKind.Class
            : kind === 'interface'
              ? SymbolKind.Interface
              : SymbolKind.Enum,
        location: {
          file: filePath,
          line: lineNumber,
        },
        members: [],
      });
    }

    return symbols;
  }

  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /import\s+(?:static\s+)?([^;]+);/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1].trim();
      const parts = importPath.split('.');
      const isWildcard = importPath.endsWith('.*');

      imports.push({
        source: importPath,
        specifiers: isWildcard ? ['*'] : [parts[parts.length - 1]],
        isDefault: false,
        isNamespace: isWildcard,
        isExternal: true,
      });
    }

    return imports;
  }

  private extractExports(symbols: CodeSymbol[]): ExportInfo[] {
    return symbols
      .filter((s) => s.modifiers?.includes('public'))
      .map((s) => ({
        name: s.name,
        kind: s.kind,
        isDefault: false,
      }));
  }

  private calculateSummaryStats(result: ParseResult): void {
    result.summary.byKind = {} as Record<SymbolKind, number>;
    result.summary.byLanguage = { [this.language]: result.files.length } as any;

    for (const file of result.files) {
      for (const symbol of file.symbols) {
        result.summary.byKind[symbol.kind] = (result.summary.byKind[symbol.kind] || 0) + 1;
      }
    }
  }
}
