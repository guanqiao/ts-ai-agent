import {
  Project,
  SourceFile,
  ClassDeclaration,
  InterfaceDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  EnumDeclaration,
  TypeAliasDeclaration,
  VariableDeclaration,
  Node,
  SyntaxKind,
  ParameterDeclaration,
  ConstructorDeclaration,
} from 'ts-morph';
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
  ParameterInfo,
  GenericInfo,
  DecoratorInfo,
} from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export class TypeScriptParser extends BaseParser {
  readonly language = Language.TypeScript;
  private project: Project | null = null;

  private getProject(): Project {
    if (!this.project) {
      this.project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          allowJs: true,
          checkJs: false,
        },
      });
    }
    return this.project;
  }

  isSupported(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].includes(ext);
  }

  async parse(filePath: string, options?: ParserOptions): Promise<ParsedFile> {
    const startTime = Date.now();
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const project = this.getProject();
    const sourceFile = project.addSourceFileAtPath(absolutePath);

    try {
      const symbols = this.extractSymbols(sourceFile, options);
      const imports = this.extractImports(sourceFile);
      const exports = this.extractExports(sourceFile);

      const parsedFile: ParsedFile = {
        path: absolutePath,
        language: this.language,
        symbols,
        imports,
        exports,
        rawContent: sourceFile.getFullText(),
        parseTime: Date.now() - startTime,
      };

      return parsedFile;
    } finally {
      project.removeSourceFile(sourceFile);
    }
  }

  async parseDirectory(dirPath: string, options?: ParserOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const result = this.createEmptyResult();
    const absoluteDir = path.resolve(dirPath);

    const patterns = options?.includePatterns?.length
      ? options.includePatterns.map((p) => path.join(absoluteDir, p))
      : [path.join(absoluteDir, '**/*.{ts,tsx,js,jsx}')];

    const excludePatterns = options?.excludePatterns || ['node_modules/**', 'dist/**', 'build/**'];

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

  private extractSymbols(sourceFile: SourceFile, options?: ParserOptions): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];

    sourceFile.getClasses().forEach((cls) => {
      if (!this.shouldSkipSymbol(cls, options)) {
        symbols.push(this.extractClassSymbol(cls));
      }
    });

    sourceFile.getInterfaces().forEach((int) => {
      symbols.push(this.extractInterfaceSymbol(int));
    });

    sourceFile.getFunctions().forEach((fn) => {
      if (!this.shouldSkipSymbol(fn, options)) {
        symbols.push(this.extractFunctionSymbol(fn));
      }
    });

    sourceFile.getEnums().forEach((en) => {
      symbols.push(this.extractEnumSymbol(en));
    });

    sourceFile.getTypeAliases().forEach((ta) => {
      symbols.push(this.extractTypeAliasSymbol(ta));
    });

    sourceFile.getVariableDeclarations().forEach((v) => {
      if (!this.shouldSkipSymbol(v, options)) {
        symbols.push(this.extractVariableSymbol(v));
      }
    });

    return symbols;
  }

  private shouldSkipSymbol(node: Node, options?: ParserOptions): boolean {
    if (options?.includePrivate) return false;

    if ('getModifiers' in node && typeof (node as any).getModifiers === 'function') {
      const modifiers = (node as any).getModifiers() || [];
      const isPrivate = modifiers.some(
        (m: any) => m.getKind() === SyntaxKind.PrivateKeyword || m.getKind() === SyntaxKind.ProtectedKeyword
      );
      return isPrivate;
    }

    return false;
  }

  private extractClassSymbol(cls: ClassDeclaration): CodeSymbol {
    const symbol: CodeSymbol = {
      name: cls.getName() || '<anonymous>',
      kind: SymbolKind.Class,
      location: this.getLocation(cls),
      description: this.getJSDocDescription(cls),
      documentation: this.getJSDocText(cls),
      modifiers: this.getModifiers(cls),
      decorators: this.getDecorators(cls),
      generics: this.getGenerics(cls),
      extends: this.getExtends(cls),
      implements: this.getImplements(cls),
      members: [],
    };

    cls.getProperties().forEach((prop) => {
      symbol.members!.push(this.extractPropertySymbol(prop));
    });

    cls.getMethods().forEach((method) => {
      symbol.members!.push(this.extractMethodSymbol(method));
    });

    cls.getConstructors().forEach((ctor) => {
      symbol.members!.push(this.extractConstructorSymbol(ctor));
    });

    return symbol;
  }

  private extractInterfaceSymbol(int: InterfaceDeclaration): CodeSymbol {
    const symbol: CodeSymbol = {
      name: int.getName(),
      kind: SymbolKind.Interface,
      location: this.getLocation(int),
      description: this.getJSDocDescription(int),
      documentation: this.getJSDocText(int),
      generics: this.getGenerics(int),
      extends: this.getInterfaceExtends(int),
      members: [],
    };

    int.getProperties().forEach((prop) => {
      const memberSymbol: CodeSymbol = {
        name: prop.getName(),
        kind: SymbolKind.Property,
        location: this.getLocation(prop),
        type: prop.getType().getText(),
        description: this.getJSDocDescription(prop),
      };
      symbol.members!.push(memberSymbol);
    });

    int.getMethods().forEach((method) => {
      const memberSymbol: CodeSymbol = {
        name: method.getName(),
        kind: SymbolKind.Method,
        location: this.getLocation(method),
        returnType: method.getReturnType().getText(),
        parameters: this.getParameters(method.getParameters()),
        description: this.getJSDocDescription(method),
      };
      symbol.members!.push(memberSymbol);
    });

    return symbol;
  }

  private extractFunctionSymbol(fn: FunctionDeclaration): CodeSymbol {
    return {
      name: fn.getName() || '<anonymous>',
      kind: SymbolKind.Function,
      location: this.getLocation(fn),
      description: this.getJSDocDescription(fn),
      documentation: this.getJSDocText(fn),
      signature: this.getFunctionSignature(fn),
      parameters: this.getParameters(fn.getParameters()),
      returnType: fn.getReturnType().getText(),
      modifiers: this.getModifiers(fn),
      generics: this.getGenerics(fn),
    };
  }

  private extractMethodSymbol(method: MethodDeclaration): CodeSymbol {
    return {
      name: method.getName(),
      kind: SymbolKind.Method,
      location: this.getLocation(method),
      description: this.getJSDocDescription(method),
      signature: method.getText().split('{')[0].trim(),
      parameters: this.getParameters(method.getParameters()),
      returnType: method.getReturnType().getText(),
      modifiers: this.getModifiers(method),
    };
  }

  private extractPropertySymbol(prop: PropertyDeclaration): CodeSymbol {
    return {
      name: prop.getName(),
      kind: SymbolKind.Property,
      location: this.getLocation(prop),
      type: prop.getType().getText(),
      description: this.getJSDocDescription(prop),
      modifiers: this.getModifiers(prop),
    };
  }

  private extractConstructorSymbol(ctor: ConstructorDeclaration): CodeSymbol {
    return {
      name: 'constructor',
      kind: SymbolKind.Constructor,
      location: this.getLocation(ctor),
      description: this.getJSDocDescription(ctor),
      parameters: this.getParameters(ctor.getParameters()),
      modifiers: this.getModifiers(ctor),
    };
  }

  private extractEnumSymbol(en: EnumDeclaration): CodeSymbol {
    const symbol: CodeSymbol = {
      name: en.getName(),
      kind: SymbolKind.Enum,
      location: this.getLocation(en),
      description: this.getJSDocDescription(en),
      members: [],
    };

    en.getMembers().forEach((member) => {
      symbol.members!.push({
        name: member.getName(),
        kind: SymbolKind.EnumMember,
        location: this.getLocation(member),
        type: member.getValue()?.toString(),
      });
    });

    return symbol;
  }

  private extractTypeAliasSymbol(ta: TypeAliasDeclaration): CodeSymbol {
    return {
      name: ta.getName(),
      kind: SymbolKind.TypeAlias,
      location: this.getLocation(ta),
      description: this.getJSDocDescription(ta),
      type: ta.getType().getText(),
      generics: this.getGenerics(ta),
    };
  }

  private extractVariableSymbol(v: VariableDeclaration): CodeSymbol {
    const parent = v.getVariableStatement();
    const isConst = parent?.getDeclarationKind() === 'const';

    return {
      name: v.getName(),
      kind: isConst ? SymbolKind.Constant : SymbolKind.Variable,
      location: this.getLocation(v),
      type: v.getType().getText(),
      description: this.getJSDocDescription(parent || v),
    };
  }

  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    return sourceFile.getImportDeclarations().map((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const isExternal = !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

      return {
        source: moduleSpecifier,
        specifiers: imp.getNamedImports().map((ni) => ni.getName()),
        isDefault: imp.getDefaultImport() !== undefined,
        isNamespace: imp.getNamespaceImport() !== undefined,
        isExternal,
      };
    });
  }

  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    sourceFile.getExportDeclarations().forEach((exp) => {
      exp.getNamedExports().forEach((ne) => {
        exports.push({
          name: ne.getName(),
          kind: SymbolKind.Variable,
          isDefault: false,
        });
      });
    });

    sourceFile.getExportedDeclarations().forEach((_, name) => {
      exports.push({
        name,
        kind: SymbolKind.Variable,
        isDefault: name === 'default',
      });
    });

    return exports;
  }

  private getLocation(node: Node): CodeSymbol['location'] {
    const sourceFile = node.getSourceFile();
    const start = node.getStartLineNumber();
    const end = node.getEndLineNumber();

    return {
      file: sourceFile.getFilePath(),
      line: start,
      endLine: end,
    };
  }

  private getJSDocDescription(node: Node): string | undefined {
    if (Node.isJSDocable(node)) {
      const docs = node.getJsDocs();
      if (docs.length === 0) return undefined;
      return docs[0].getDescription().trim();
    }
    return undefined;
  }

  private getJSDocText(node: Node): string | undefined {
    if (Node.isJSDocable(node)) {
      const docs = node.getJsDocs();
      if (docs.length === 0) return undefined;
      return docs.map((d) => d.getText()).join('\n');
    }
    return undefined;
  }

  private getModifiers(node: Node): string[] | undefined {
    if ('getModifiers' in node && typeof (node as any).getModifiers === 'function') {
      const modifiers = (node as any).getModifiers() || [];
      if (modifiers.length === 0) return undefined;
      return modifiers.map((m: any) => m.getKindName().replace('Keyword', '').toLowerCase());
    }
    return undefined;
  }

  private getDecorators(node: Node): DecoratorInfo[] | undefined {
    if (Node.isDecoratable(node)) {
      const decorators = node.getDecorators();
      if (decorators.length === 0) return undefined;
      return decorators.map((d) => ({
        name: d.getName(),
        arguments: d.getArguments().map((a) => a.getText()),
      }));
    }
    return undefined;
  }

  private getGenerics(node: Node): GenericInfo[] | undefined {
    if ('getTypeParameters' in node && typeof (node as any).getTypeParameters === 'function') {
      const typeParams = (node as any).getTypeParameters() || [];
      if (typeParams.length === 0) return undefined;
      return typeParams.map((tp: any) => ({
        name: tp.getName(),
        constraint: tp.getConstraint()?.getText(),
        default: tp.getDefault()?.getText(),
      }));
    }
    return undefined;
  }

  private getExtends(cls: ClassDeclaration): string[] | undefined {
    const ext = cls.getExtends();
    return ext ? [ext.getText()] : undefined;
  }

  private getImplements(cls: ClassDeclaration): string[] | undefined {
    const impls = cls.getImplements();
    return impls.length > 0 ? impls.map((i) => i.getText()) : undefined;
  }

  private getInterfaceExtends(int: InterfaceDeclaration): string[] | undefined {
    const exts = int.getExtends();
    return exts.length > 0 ? exts.map((e) => e.getText()) : undefined;
  }

  private getParameters(params: ParameterDeclaration[]): ParameterInfo[] {
    return params.map((p) => ({
      name: p.getName(),
      type: p.getType().getText(),
      optional: p.isOptional(),
      defaultValue: p.getInitializer()?.getText(),
    }));
  }

  private getFunctionSignature(fn: FunctionDeclaration): string {
    const name = fn.getName() || '';
    const typeParams = fn.getTypeParameters().length > 0 ? `<${fn.getTypeParameters().map((t) => t.getText()).join(', ')}>` : '';
    const params = fn.getParameters().map((p) => p.getText()).join(', ');
    const returnType = fn.getReturnTypeNode()?.getText() || fn.getReturnType().getText();

    return `${name}${typeParams}(${params}): ${returnType}`;
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
