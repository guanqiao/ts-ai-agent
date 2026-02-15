import {
  GeneratedDocument,
  DocumentSection,
  DocumentFormat,
  ParsedFile,
  CodeSymbol,
} from '../types';

export class MarkdownGenerator {
  generate(document: GeneratedDocument): string {
    const lines: string[] = [];

    lines.push(`# ${document.title}\n`);

    if (document.description) {
      lines.push(`> ${document.description}\n`);
    }

    lines.push(this.generateTableOfContents(document.sections));
    lines.push('');

    for (const section of document.sections) {
      lines.push(this.renderSection(section, 2));
    }

    lines.push('\n---\n');
    lines.push(this.generateFooter(document));

    return lines.join('\n');
  }

  private generateTableOfContents(sections: DocumentSection[]): string {
    const lines: string[] = ['## 目录\n'];

    const renderTocItem = (section: DocumentSection, indent: number): void => {
      const prefix = '  '.repeat(indent);
      lines.push(`${prefix}- [${section.title}](#${this.slugify(section.id)})`);

      if (section.subsections) {
        for (const sub of section.subsections) {
          renderTocItem(sub, indent + 1);
        }
      }
    };

    for (const section of sections) {
      renderTocItem(section, 0);
    }

    return lines.join('\n');
  }

  private renderSection(section: DocumentSection, level: number): string {
    const lines: string[] = [];
    const heading = '#'.repeat(level);

    lines.push(`${heading} ${section.title}\n`);

    if (section.content) {
      lines.push(section.content);
      lines.push('');
    }

    if (section.subsections) {
      for (const sub of section.subsections) {
        lines.push(this.renderSection(sub, level + 1));
      }
    }

    return lines.join('\n');
  }

  private generateFooter(document: GeneratedDocument): string {
    const lines: string[] = [];

    lines.push('<details>');
    lines.push('<summary>文档信息</summary>\n');
    lines.push(`- **生成时间**: ${document.metadata.generatedAt.toISOString()}`);
    lines.push(`- **生成器**: ${document.metadata.generator} v${document.metadata.version}`);
    lines.push(`- **源文件数**: ${document.metadata.sourceFiles.length}`);
    lines.push('</details>');

    return lines.join('\n');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export class ConfluenceGenerator {
  generate(document: GeneratedDocument): string {
    const lines: string[] = [];

    lines.push(`h1. ${document.title}\n`);

    if (document.description) {
      lines.push(`{quote}${document.description}{quote}\n`);
    }

    lines.push('{toc}\n');

    for (const section of document.sections) {
      lines.push(this.renderConfluenceSection(section, 2));
    }

    return lines.join('\n');
  }

  private renderConfluenceSection(section: DocumentSection, level: number): string {
    const lines: string[] = [];

    lines.push(`h${level}. ${section.title}\n`);

    if (section.content) {
      lines.push(section.content);
      lines.push('');
    }

    if (section.subsections) {
      for (const sub of section.subsections) {
        lines.push(this.renderConfluenceSection(sub, level + 1));
      }
    }

    return lines.join('\n');
  }
}

export class GitHubWikiGenerator {
  generate(document: GeneratedDocument): string {
    const markdown = new MarkdownGenerator().generate(document);

    return markdown.replace(/## 目录\n[\s\S]*?(?=\n##)/, '');
  }
}

export class DocumentGenerator {
  private markdown: MarkdownGenerator;
  private confluence: ConfluenceGenerator;
  private githubWiki: GitHubWikiGenerator;

  constructor() {
    this.markdown = new MarkdownGenerator();
    this.confluence = new ConfluenceGenerator();
    this.githubWiki = new GitHubWikiGenerator();
  }

  generate(document: GeneratedDocument, format: DocumentFormat): string {
    switch (format) {
      case DocumentFormat.Markdown:
        return this.markdown.generate(document);
      case DocumentFormat.Confluence:
        return this.confluence.generate(document);
      case DocumentFormat.GitHubWiki:
        return this.githubWiki.generate(document);
      default:
        return this.markdown.generate(document);
    }
  }

  generateSymbolDoc(symbol: CodeSymbol): string {
    const lines: string[] = [];

    lines.push(`## ${symbol.name}\n`);

    if (symbol.description) {
      lines.push(`${symbol.description}\n`);
    }

    if (symbol.decorators && symbol.decorators.length > 0) {
      lines.push('**装饰器**: ' + symbol.decorators.map((d) => `@${d.name}`).join(', ') + '\n');
    }

    if (symbol.generics && symbol.generics.length > 0) {
      lines.push('**泛型参数**:\n');
      for (const g of symbol.generics) {
        lines.push(`- \`${g.name}\`${g.constraint ? ` extends ${g.constraint}` : ''}`);
      }
      lines.push('');
    }

    if (symbol.extends && symbol.extends.length > 0) {
      lines.push(`**继承**: ${symbol.extends.join(', ')}\n`);
    }

    if (symbol.implements && symbol.implements.length > 0) {
      lines.push(`**实现**: ${symbol.implements.join(', ')}\n`);
    }

    if (symbol.parameters && symbol.parameters.length > 0) {
      lines.push('### 参数\n');
      lines.push('| 名称 | 类型 | 可选 | 默认值 | 描述 |');
      lines.push('|------|------|------|--------|------|');
      for (const p of symbol.parameters) {
        lines.push(
          `| ${p.name} | ${p.type} | ${p.optional ? '是' : '否'} | ${p.defaultValue || '-'} | ${p.description || '-'} |`
        );
      }
      lines.push('');
    }

    if (symbol.returnType) {
      lines.push(`### 返回值\n\`${symbol.returnType}\`\n`);
    }

    if (symbol.members && symbol.members.length > 0) {
      lines.push('### 成员\n');
      for (const member of symbol.members) {
        lines.push(`#### ${member.name}\n`);
        if (member.type) lines.push(`类型: \`${member.type}\`\n`);
        if (member.description) lines.push(`${member.description}\n`);
      }
    }

    return lines.join('\n');
  }

  generateFileSummary(file: ParsedFile): string {
    const lines: string[] = [];

    lines.push(`# ${file.path}\n`);
    lines.push(`语言: ${file.language}`);
    lines.push(`符号数: ${file.symbols.length}`);
    lines.push(`解析耗时: ${file.parseTime}ms\n`);

    const byKind = this.groupByKind(file.symbols);
    for (const [kind, symbols] of Object.entries(byKind)) {
      lines.push(`## ${kind} (${symbols.length})\n`);
      for (const s of symbols) {
        lines.push(`- **${s.name}**`);
        if (s.description) lines.push(` - ${s.description.substring(0, 100)}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private groupByKind(symbols: CodeSymbol[]): Record<string, CodeSymbol[]> {
    const groups: Record<string, CodeSymbol[]> = {};

    for (const symbol of symbols) {
      const kind = symbol.kind;
      if (!groups[kind]) {
        groups[kind] = [];
      }
      groups[kind].push(symbol);
    }

    return groups;
  }
}
