import { ParsedFile, SymbolKind } from '../../types';
import {
  SymbolLocation,
  SymbolLocationKind,
  ISymbolTracker,
  Range,
} from './types';

export class SymbolTracker implements ISymbolTracker {
  private symbolTable: Map<string, SymbolLocation[]> = new Map();
  private parsedFiles: Map<string, ParsedFile> = new Map();

  constructor(_projectPath: string) {}

  loadParsedFiles(files: ParsedFile[]): void {
    this.parsedFiles.clear();
    this.symbolTable.clear();

    for (const file of files) {
      this.parsedFiles.set(file.path, file);
      this.indexSymbols(file);
    }
  }

  async trackSymbol(symbolName: string, filePath: string): Promise<SymbolLocation | null> {
    const locations = this.symbolTable.get(symbolName);
    if (!locations) {
      return null;
    }

    return locations.find((loc) => loc.filePath === filePath) || locations[0] || null;
  }

  async findUsages(symbolName: string): Promise<SymbolLocation[]> {
    const locations = this.symbolTable.get(symbolName);
    return locations || [];
  }

  async getDefinition(symbolName: string): Promise<SymbolLocation | null> {
    const locations = this.symbolTable.get(symbolName);
    if (!locations || locations.length === 0) {
      return null;
    }

    return locations.find((loc) =>
      loc.kind === 'class' ||
      loc.kind === 'interface' ||
      loc.kind === 'function' ||
      loc.kind === 'type'
    ) || locations[0];
  }

  async getReferences(symbolName: string): Promise<SymbolLocation[]> {
    const locations = this.symbolTable.get(symbolName);
    if (!locations) {
      return [];
    }

    const definition = await this.getDefinition(symbolName);
    if (!definition) {
      return locations;
    }

    return locations.filter((loc) =>
      loc.filePath !== definition.filePath ||
      !this.rangesEqual(loc.range, definition.range)
    );
  }

  getSymbolsByFile(filePath: string): SymbolLocation[] {
    const symbols: SymbolLocation[] = [];

    for (const [, locations] of this.symbolTable) {
      for (const loc of locations) {
        if (loc.filePath === filePath) {
          symbols.push(loc);
        }
      }
    }

    return symbols;
  }

  getSymbolNames(): string[] {
    return Array.from(this.symbolTable.keys());
  }

  private indexSymbols(file: ParsedFile): void {
    for (const symbol of file.symbols) {
      const location = this.createSymbolLocation(symbol.name, symbol.kind, file.path);
      if (!location) continue;

      if (!this.symbolTable.has(symbol.name)) {
        this.symbolTable.set(symbol.name, []);
      }
      this.symbolTable.get(symbol.name)!.push(location);
    }
  }

  private createSymbolLocation(
    name: string,
    kind: SymbolKind,
    filePath: string
  ): SymbolLocation | null {
    const locationKind = this.mapSymbolKind(kind);
    if (!locationKind) return null;

    return {
      symbolName: name,
      kind: locationKind,
      filePath,
      range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    };
  }

  private mapSymbolKind(kind: SymbolKind): SymbolLocationKind | null {
    const mapping: Partial<Record<SymbolKind, SymbolLocationKind | null>> = {
      [SymbolKind.Class]: 'class',
      [SymbolKind.Interface]: 'interface',
      [SymbolKind.Function]: 'function',
      [SymbolKind.Method]: 'method',
      [SymbolKind.Property]: 'property',
      [SymbolKind.Enum]: 'enum',
      [SymbolKind.TypeAlias]: 'type',
      [SymbolKind.Variable]: 'variable',
      [SymbolKind.Constant]: 'constant',
      [SymbolKind.Module]: null,
      [SymbolKind.Namespace]: null,
      [SymbolKind.Constructor]: 'method',
      [SymbolKind.Field]: 'property',
      [SymbolKind.EnumMember]: null,
      [SymbolKind.Annotation]: null,
      [SymbolKind.Package]: null,
    };

    return mapping[kind] ?? null;
  }

  private rangesEqual(a: Range, b: Range): boolean {
    return (
      a.start.line === b.start.line &&
      a.start.column === b.start.column &&
      a.end.line === b.end.line &&
      a.end.column === b.end.column
    );
  }
}
