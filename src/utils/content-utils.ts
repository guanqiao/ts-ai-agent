import { CodeSymbol, SymbolKind } from '../types';

export interface WikiSection {
  title: string;
  content: string;
  level: number;
  startLine: number;
  endLine: number;
}

export interface GroupedSymbols {
  classes: CodeSymbol[];
  interfaces: CodeSymbol[];
  functions: CodeSymbol[];
  types: CodeSymbol[];
  enums: CodeSymbol[];
  variables: CodeSymbol[];
  constants: CodeSymbol[];
  others: CodeSymbol[];
}

const SECTION_PATTERN = /^(#{1,6})\s+(.+?)\s*$/gm;

export function extractSections(content: string): WikiSection[] {
  const sections: WikiSection[] = [];
  const lines = content.split('\n');
  
  let match;
  const contentForRegex = content;
  
  while ((match = SECTION_PATTERN.exec(contentForRegex)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const startLine = content.substring(0, match.index).split('\n').length;
    
    if (sections.length > 0) {
      sections[sections.length - 1].endLine = startLine - 1;
    }
    
    sections.push({
      title,
      content: '',
      level,
      startLine,
      endLine: lines.length,
    });
  }
  
  for (let i = 0; i < sections.length; i++) {
    const startIdx = sections[i].startLine - 1;
    const endIdx = i < sections.length - 1 ? sections[i + 1].startLine - 1 : lines.length;
    sections[i].content = lines.slice(startIdx, endIdx).join('\n');
  }
  
  return sections;
}

export function groupSymbolsByKind(symbols: CodeSymbol[]): GroupedSymbols {
  const result: GroupedSymbols = {
    classes: [],
    interfaces: [],
    functions: [],
    types: [],
    enums: [],
    variables: [],
    constants: [],
    others: [],
  };
  
  for (const symbol of symbols) {
    switch (symbol.kind) {
      case SymbolKind.Class:
        result.classes.push(symbol);
        break;
      case SymbolKind.Interface:
        result.interfaces.push(symbol);
        break;
      case SymbolKind.Function:
      case SymbolKind.Method:
        result.functions.push(symbol);
        break;
      case SymbolKind.TypeAlias:
        result.types.push(symbol);
        break;
      case SymbolKind.Enum:
        result.enums.push(symbol);
        break;
      case SymbolKind.Variable:
        result.variables.push(symbol);
        break;
      case SymbolKind.Constant:
        result.constants.push(symbol);
        break;
      default:
        result.others.push(symbol);
    }
  }
  
  return result;
}

export function getModuleName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  const srcIndex = parts.indexOf('src');
  
  if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
    return parts[srcIndex + 1];
  }
  
  const lastDir = parts.length > 1 ? parts[parts.length - 2] : null;
  return lastDir || 'root';
}

export function getSymbolCounts(symbols: CodeSymbol[]): Map<SymbolKind, number> {
  const counts = new Map<SymbolKind, number>();
  
  for (const symbol of symbols) {
    counts.set(symbol.kind, (counts.get(symbol.kind) || 0) + 1);
  }
  
  return counts;
}

export function formatSymbolList(symbols: CodeSymbol[], maxItems: number = 10): string {
  const items = symbols.slice(0, maxItems);
  const lines = items.map(s => `- \`${s.name}\``);
  
  if (symbols.length > maxItems) {
    lines.push(`- ... and ${symbols.length - maxItems} more`);
  }
  
  return lines.join('\n');
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

export function generateAnchorId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isPublicSymbol(symbol: CodeSymbol): boolean {
  return (
    symbol.modifiers?.includes('export') ||
    symbol.modifiers?.includes('public') ||
    false
  );
}

export function isPrivateSymbol(symbol: CodeSymbol): boolean {
  return (
    symbol.modifiers?.includes('private') ||
    symbol.modifiers?.includes('protected') ||
    symbol.name.startsWith('_') ||
    false
  );
}

export function sortByVisibility(symbols: CodeSymbol[]): CodeSymbol[] {
  return [...symbols].sort((a, b) => {
    const aPublic = isPublicSymbol(a);
    const bPublic = isPublicSymbol(b);
    
    if (aPublic && !bPublic) return -1;
    if (!aPublic && bPublic) return 1;
    
    return a.name.localeCompare(b.name);
  });
}

export function extractDescription(doc: string | undefined): string {
  if (!doc) return '';
  
  const firstLine = doc.split('\n')[0].trim();
  return firstLine.replace(/^\/\*\*\s*/, '').replace(/\s*\*\/$/, '');
}
