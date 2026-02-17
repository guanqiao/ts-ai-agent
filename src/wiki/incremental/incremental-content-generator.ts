import { ParsedFile, CodeSymbol, SymbolKind } from '../../types';
import { WikiPage, WikiSection } from '../types';
import { SymbolChange } from './symbol-tracker';

export interface IncrementalContentResult {
  content: string;
  sections: WikiSection[];
  symbolsProcessed: string[];
  symbolsSkipped: string[];
}

export interface SymbolContent {
  symbolName: string;
  symbolKind: SymbolKind;
  content: string;
  section: WikiSection;
}

export class IncrementalContentGenerator {
  generateSymbolContent(symbol: CodeSymbol, _filePath: string): SymbolContent {
    const content = this.createSymbolMarkdown(symbol);
    const section: WikiSection = {
      id: `section-${symbol.name}`,
      title: symbol.name,
      content,
      level: 3,
      order: 0,
    };

    return {
      symbolName: symbol.name,
      symbolKind: symbol.kind,
      content,
      section,
    };
  }

  generateSymbolsContent(symbols: CodeSymbol[], title: string): string {
    const grouped = this.groupSymbolsByKind(symbols);

    let content = `## ${title}\n\n`;

    if (grouped.classes.length > 0) {
      content += `### Classes\n\n`;
      for (const symbol of grouped.classes) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.interfaces.length > 0) {
      content += `### Interfaces\n\n`;
      for (const symbol of grouped.interfaces) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.functions.length > 0) {
      content += `### Functions\n\n`;
      for (const symbol of grouped.functions) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.other.length > 0) {
      for (const symbol of grouped.other) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    return content;
  }

  updatePageWithSymbolChanges(
    page: WikiPage,
    changes: SymbolChange[],
    allSymbols: Map<string, CodeSymbol>
  ): IncrementalContentResult {
    const symbolsProcessed: string[] = [];
    const symbolsSkipped: string[] = [];

    let content = page.content;

    for (const change of changes) {
      const symbolId = change.symbolId;
      const symbol = allSymbols.get(symbolId);

      if (!symbol && change.changeType !== 'deleted') {
        symbolsSkipped.push(symbolId);
        continue;
      }

      switch (change.changeType) {
        case 'added':
          if (symbol) {
            content = this.insertSymbol(content, symbol);
            symbolsProcessed.push(symbolId);
          }
          break;

        case 'modified':
          if (symbol) {
            content = this.updateSymbol(content, symbol);
            symbolsProcessed.push(symbolId);
          }
          break;

        case 'deleted':
          content = this.removeSymbol(content, change.symbolName);
          symbolsProcessed.push(symbolId);
          break;

        case 'renamed':
          if (symbol && change.oldSnapshot) {
            content = this.renameSymbol(content, change.oldSnapshot.name, symbol);
            symbolsProcessed.push(symbolId);
          }
          break;
      }
    }

    const sections = this.extractSections(content);

    return {
      content,
      sections,
      symbolsProcessed,
      symbolsSkipped,
    };
  }

  generateModuleSection(
    moduleName: string,
    files: ParsedFile[],
    changedSymbols?: Set<string>
  ): string {
    const relevantFiles = files.filter(f => this.isInModule(f.path, moduleName));

    if (changedSymbols && changedSymbols.size > 0) {
      return this.generateIncrementalModuleContent(moduleName, relevantFiles, changedSymbols);
    }

    return this.generateFullModuleContent(moduleName, relevantFiles);
  }

  generateAPISection(
    files: ParsedFile[],
    changedSymbols?: Set<string>
  ): string {
    const exportedSymbols = this.extractExportedSymbols(files);

    if (changedSymbols && changedSymbols.size > 0) {
      const filteredSymbols = exportedSymbols.filter(s =>
        changedSymbols.has(`${s.filePath}:${s.symbol.name}:${s.symbol.kind}`)
      );
      return this.generateIncrementalAPIContent(filteredSymbols);
    }

    return this.generateFullAPIContent(exportedSymbols);
  }

  private createSymbolMarkdown(symbol: CodeSymbol): string {
    let content = `### ${symbol.name}\n\n`;

    if (symbol.description) {
      content += `${symbol.description}\n\n`;
    }

    if (symbol.signature) {
      content += '```typescript\n';
      content += symbol.signature;
      content += '\n```\n\n';
    }

    if (symbol.members && symbol.members.length > 0) {
      content += '**Members:**\n\n';
      content += '| Name | Kind | Type | Description |\n';
      content += '|------|------|------|-------------|\n';
      for (const member of symbol.members) {
        content += `| ${member.name} | ${member.kind} | ${member.type || '-'} | ${member.description || '-'} |\n`;
      }
      content += '\n';
    }

    if (symbol.parameters && symbol.parameters.length > 0) {
      content += '**Parameters:**\n\n';
      content += '| Name | Type | Optional | Description |\n';
      content += '|------|------|----------|-------------|\n';
      for (const param of symbol.parameters) {
        content += `| ${param.name} | ${param.type || '-'} | ${param.optional ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
      }
      content += '\n';
    }

    if (symbol.returnType) {
      content += `**Returns:** \`${symbol.returnType}\`\n\n`;
    }

    return content;
  }

  private groupSymbolsByKind(symbols: CodeSymbol[]): {
    classes: CodeSymbol[];
    interfaces: CodeSymbol[];
    functions: CodeSymbol[];
    other: CodeSymbol[];
  } {
    return {
      classes: symbols.filter(s => s.kind === SymbolKind.Class),
      interfaces: symbols.filter(s => s.kind === SymbolKind.Interface),
      functions: symbols.filter(s => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method),
      other: symbols.filter(s =>
        s.kind !== SymbolKind.Class &&
        s.kind !== SymbolKind.Interface &&
        s.kind !== SymbolKind.Function &&
        s.kind !== SymbolKind.Method
      ),
    };
  }

  private insertSymbol(content: string, symbol: CodeSymbol): string {
    const symbolContent = this.createSymbolMarkdown(symbol);

    const targetSection = this.findTargetSection(content, symbol.kind);
    if (targetSection) {
      return this.insertInSection(content, targetSection, symbolContent);
    }

    return content + '\n\n' + symbolContent;
  }

  private updateSymbol(content: string, symbol: CodeSymbol): string {
    const symbolContent = this.createSymbolMarkdown(symbol);
    const pattern = new RegExp(
      `### ${this.escapeRegExp(symbol.name)}\\n[\\s\\S]*?(?=### |$)`,
      'g'
    );

    if (pattern.test(content)) {
      return content.replace(pattern, symbolContent);
    }

    return this.insertSymbol(content, symbol);
  }

  private removeSymbol(content: string, symbolName: string): string {
    const pattern = new RegExp(
      `### ${this.escapeRegExp(symbolName)}\\n[\\s\\S]*?(?=### |$)`,
      'g'
    );
    return content.replace(pattern, '');
  }

  private renameSymbol(content: string, oldName: string, symbol: CodeSymbol): string {
    const symbolContent = this.createSymbolMarkdown(symbol);
    const pattern = new RegExp(
      `### ${this.escapeRegExp(oldName)}\\n[\\s\\S]*?(?=### |$)`,
      'g'
    );

    if (pattern.test(content)) {
      return content.replace(pattern, symbolContent);
    }

    return this.insertSymbol(content, symbol);
  }

  private findTargetSection(content: string, symbolKind: SymbolKind): string | null {
    const classSection = SymbolKind.Class;
    const interfaceSection = SymbolKind.Interface;
    const functionSection = SymbolKind.Function;
    const methodSection = SymbolKind.Method;

    const sectionMap = new Map<SymbolKind, string>([
      [classSection, 'Classes'],
      [interfaceSection, 'Interfaces'],
      [functionSection, 'Functions'],
      [methodSection, 'Functions'],
    ]);

    const targetSection = sectionMap.get(symbolKind);
    if (!targetSection) {
      return null;
    }

    const pattern = new RegExp(`### ${targetSection}`, 'g');
    if (pattern.test(content)) {
      return targetSection;
    }

    return null;
  }

  private insertInSection(content: string, sectionName: string, newContent: string): string {
    const pattern = new RegExp(`(### ${sectionName}\\n)`);
    return content.replace(pattern, `$1\n${newContent}\n`);
  }

  private extractSections(content: string): WikiSection[] {
    const sections: WikiSection[] = [];
    const pattern = /^(#{1,6}) (.+)$/gm;
    let match;
    let order = 0;
    const matches: { level: number; title: string; index: number }[] = [];

    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        level: match[1].length,
        title: match[2].trim(),
        index: match.index,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
      const sectionContent = content.slice(start, end).trim();

      sections.push({
        id: `section-${order}`,
        title: matches[i].title,
        content: sectionContent,
        level: matches[i].level,
        order: order++,
      });
    }

    return sections;
  }

  private isInModule(filePath: string, moduleName: string): boolean {
    const parts = filePath.split('/');
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1] === moduleName;
    }
    return parts[parts.length - 2] === moduleName;
  }

  private generateIncrementalModuleContent(
    moduleName: string,
    files: ParsedFile[],
    changedSymbols: Set<string>
  ): string {
    let content = `# Module: ${moduleName}\n\n`;
    content += `## Changed Symbols\n\n`;

    for (const file of files) {
      for (const symbol of file.symbols) {
        const symbolId = `${file.path}:${symbol.name}:${symbol.kind}`;
        if (changedSymbols.has(symbolId)) {
          content += this.createSymbolMarkdown(symbol) + '\n\n';
        }
      }
    }

    return content;
  }

  private generateFullModuleContent(moduleName: string, files: ParsedFile[]): string {
    const symbols = files.flatMap(f => f.symbols);
    const classes = symbols.filter(s => s.kind === SymbolKind.Class);
    const interfaces = symbols.filter(s => s.kind === SymbolKind.Interface);
    const functions = symbols.filter(s => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method);

    let content = `# Module: ${moduleName}\n\n`;
    content += `## Files\n\n`;
    content += files.map(f => `- ${f.path}`).join('\n');
    content += '\n\n';
    content += `## Statistics\n\n`;
    content += `- Classes: ${classes.length}\n`;
    content += `- Interfaces: ${interfaces.length}\n`;
    content += `- Functions: ${functions.length}\n\n`;

    if (classes.length > 0) {
      content += `## Classes\n\n`;
      for (const c of classes) {
        content += this.createSymbolMarkdown(c) + '\n\n';
      }
    }

    if (interfaces.length > 0) {
      content += `## Interfaces\n\n`;
      for (const i of interfaces) {
        content += this.createSymbolMarkdown(i) + '\n\n';
      }
    }

    return content;
  }

  private extractExportedSymbols(files: ParsedFile[]): Array<{ filePath: string; symbol: CodeSymbol }> {
    const result: Array<{ filePath: string; symbol: CodeSymbol }> = [];

    for (const file of files) {
      for (const symbol of file.symbols) {
        const isExported = symbol.modifiers?.includes('export') ||
          symbol.modifiers?.includes('public') ||
          !symbol.modifiers?.includes('private');

        if (isExported && (
          symbol.kind === SymbolKind.Class ||
          symbol.kind === SymbolKind.Interface ||
          symbol.kind === SymbolKind.Function
        )) {
          result.push({ filePath: file.path, symbol });
        }
      }
    }

    return result;
  }

  private generateIncrementalAPIContent(
    symbols: Array<{ filePath: string; symbol: CodeSymbol }>
  ): string {
    let content = `# API Reference (Updated)\n\n`;

    const grouped = this.groupSymbolsByKind(symbols.map(s => s.symbol));

    if (grouped.classes.length > 0) {
      content += `## Classes\n\n`;
      for (const symbol of grouped.classes) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.interfaces.length > 0) {
      content += `## Interfaces\n\n`;
      for (const symbol of grouped.interfaces) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.functions.length > 0) {
      content += `## Functions\n\n`;
      for (const symbol of grouped.functions) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    return content;
  }

  private generateFullAPIContent(
    symbols: Array<{ filePath: string; symbol: CodeSymbol }>
  ): string {
    let content = `# API Reference\n\n`;

    const grouped = this.groupSymbolsByKind(symbols.map(s => s.symbol));

    if (grouped.classes.length > 0) {
      content += `## Classes\n\n`;
      for (const symbol of grouped.classes) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.interfaces.length > 0) {
      content += `## Interfaces\n\n`;
      for (const symbol of grouped.interfaces) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    if (grouped.functions.length > 0) {
      content += `## Functions\n\n`;
      for (const symbol of grouped.functions) {
        content += this.createSymbolMarkdown(symbol) + '\n\n';
      }
    }

    return content;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
