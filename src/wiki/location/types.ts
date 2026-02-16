export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface FileLocation {
  filePath: string;
  range?: Range;
}

export interface SymbolLocation {
  symbolName: string;
  kind: SymbolLocationKind;
  filePath: string;
  range: Range;
  containerName?: string;
}

export type SymbolLocationKind =
  | 'class'
  | 'interface'
  | 'function'
  | 'method'
  | 'property'
  | 'enum'
  | 'type'
  | 'variable'
  | 'constant';

export interface CodeLink {
  id: string;
  pageId: string;
  sectionId?: string;
  target: CodeLinkTarget;
  displayText: string;
  createdAt: Date;
}

export type CodeLinkTarget = FileLocation | SymbolLocation;

export interface ResolvedLocation {
  type: 'file' | 'symbol';
  filePath: string;
  range?: Range;
  symbolName?: string;
  symbolKind?: SymbolLocationKind;
  exists: boolean;
}

export interface ILocationLinker {
  createLink(
    pageId: string,
    target: CodeLinkTarget,
    displayText?: string,
    sectionId?: string
  ): Promise<CodeLink>;
  resolveLink(link: CodeLink): Promise<ResolvedLocation>;
  updateLinks(pageId: string, links: CodeLink[]): Promise<void>;
  getLinksByPage(pageId: string): Promise<CodeLink[]>;
  getLinksByFile(filePath: string): Promise<CodeLink[]>;
  getLinksBySymbol(symbolName: string): Promise<CodeLink[]>;
  removeLink(linkId: string): Promise<boolean>;
}

export interface ISymbolTracker {
  trackSymbol(symbolName: string, filePath: string): Promise<SymbolLocation | null>;
  findUsages(symbolName: string): Promise<SymbolLocation[]>;
  getDefinition(symbolName: string): Promise<SymbolLocation | null>;
  getReferences(symbolName: string): Promise<SymbolLocation[]>;
}

export interface ILocationIndex {
  indexLocation(location: FileLocation | SymbolLocation, linkId: string): Promise<void>;
  removeLocation(linkId: string): Promise<void>;
  queryByLocation(filePath: string, range?: Range): Promise<string[]>;
  queryByPage(pageId: string): Promise<string[]>;
  queryBySymbol(symbolName: string): Promise<string[]>;
}

export interface LocationIndexEntry {
  linkId: string;
  filePath: string;
  range?: Range;
  symbolName?: string;
  symbolKind?: SymbolLocationKind;
  pageId: string;
  sectionId?: string;
}
