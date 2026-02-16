import { EventEmitter } from 'events';
import {
  IWikiPreview,
  TableOfContentsEntry,
} from './types';

export class WikiPreview extends EventEmitter implements IWikiPreview {
  private renderedContent: string = '';
  private currentScrollPosition: number = 0;
  private highlightedSectionId: string | null = null;

  async renderPreview(content: string): Promise<string> {
    this.renderedContent = this.processMarkdown(content);
    this.emit('preview-rendered', { content: this.renderedContent });
    return this.renderedContent;
  }

  syncScroll(position: number): void {
    this.currentScrollPosition = position;
    this.emit('scroll-synced', { position });
  }

  highlightSection(sectionId: string): void {
    this.highlightedSectionId = sectionId;
    this.emit('section-highlighted', { sectionId });
  }

  async getTableOfContents(): Promise<TableOfContentsEntry[]> {
    return this.extractTableOfContents(this.renderedContent);
  }

  private processMarkdown(content: string): string {
    let processed = content;

    processed = this.processHeadings(processed);
    processed = this.processCodeBlocks(processed);
    processed = this.processInlineCode(processed);
    processed = this.processLinks(processed);
    processed = this.processImages(processed);
    processed = this.processBoldAndItalic(processed);
    processed = this.processLists(processed);
    processed = this.processTables(processed);
    processed = this.processBlockquotes(processed);
    processed = this.processHorizontalRules(processed);
    processed = this.processTaskLists(processed);

    return processed;
  }

  private processHeadings(content: string): string {
    return content
      .replace(/^###### (.+)$/gm, '<h6 id="$1">$1</h6>')
      .replace(/^##### (.+)$/gm, '<h5 id="$1">$1</h5>')
      .replace(/^#### (.+)$/gm, '<h4 id="$1">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 id="$1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 id="$1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 id="$1">$1</h1>');
  }

  private processCodeBlocks(content: string): string {
    return content.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) => {
        const escapedCode = this.escapeHtml(code.trim());
        return `<pre class="code-block" data-language="${lang || 'text'}"><code class="language-${lang || 'text'}">${escapedCode}</code></pre>`;
      }
    );
  }

  private processInlineCode(content: string): string {
    return content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }

  private processLinks(content: string): string {
    return content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => {
        const isExternal = url.startsWith('http://') || url.startsWith('https://');
        const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${url}" class="wiki-link${isExternal ? ' external' : ''}"${target}>${text}</a>`;
      }
    );
  }

  private processImages(content: string): string {
    return content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, src) => `<img src="${src}" alt="${alt}" class="wiki-image" />`
    );
  }

  private processBoldAndItalic(content: string): string {
    return content
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  }

  private processLists(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';
    let indentLevel = 0;

    for (const line of lines) {
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);

      if (ulMatch || olMatch) {
        const match = ulMatch || olMatch!;
        const indent = match[1].length;
        const text = ulMatch ? match[2] : match[3];
        const newListType = ulMatch ? 'ul' : 'ol';

        if (!inList) {
          inList = true;
          listType = newListType;
          result.push(`<${listType}>`);
        } else if (indent !== indentLevel) {
          if (indent > indentLevel) {
            result.push(`<${newListType}>`);
          } else {
            result.push(`</${listType}>`);
          }
        }

        indentLevel = indent;
        result.push(`<li>${text}</li>`);
      } else {
        if (inList) {
          result.push(`</${listType}>`);
          inList = false;
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push(`</${listType}>`);
    }

    return result.join('\n');
  }

  private processTables(content: string): string {
    const tableRegex = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm;

    return content.replace(tableRegex, (_, headerRow, bodyRows) => {
      const headers = headerRow
        .split('|')
        .map((h: string) => h.trim())
        .filter((h: string) => h);

      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) =>
          row
            .split('|')
            .map((cell: string) => cell.trim())
            .filter((cell: string) => cell !== '')
        );

      let html = '<table class="wiki-table">\n<thead>\n<tr>\n';
      headers.forEach((h: string) => {
        html += `<th>${h}</th>\n`;
      });
      html += '</tr>\n</thead>\n<tbody>\n';

      rows.forEach((row: string[]) => {
        html += '<tr>\n';
        row.forEach((cell: string) => {
          html += `<td>${cell}</td>\n`;
        });
        html += '</tr>\n';
      });

      html += '</tbody>\n</table>';
      return html;
    });
  }

  private processBlockquotes(content: string): string {
    return content.replace(
      /^>\s+(.+)$/gm,
      '<blockquote class="wiki-blockquote">$1</blockquote>'
    );
  }

  private processHorizontalRules(content: string): string {
    return content.replace(
      /^[-*_]{3,}$/gm,
      '<hr class="wiki-hr" />'
    );
  }

  private processTaskLists(content: string): string {
    return content.replace(
      /^-\s+\[([ xX])\]\s+(.+)$/gm,
      (_, checked, text) => {
        const isChecked = checked.toLowerCase() === 'x';
        return `<div class="task-item"><input type="checkbox" ${isChecked ? 'checked' : ''} disabled /> <span>${text}</span></div>`;
      }
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private extractTableOfContents(content: string): TableOfContentsEntry[] {
    const entries: TableOfContentsEntry[] = [];
    const headingRegex = /<h([1-6])\s+id="([^"]+)">([^<]+)<\/h\1>/g;
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      entries.push({
        id: match[2],
        title: match[3],
        level: parseInt(match[1], 10),
        children: [],
      });
    }

    return this.buildTocTree(entries);
  }

  private buildTocTree(entries: TableOfContentsEntry[]): TableOfContentsEntry[] {
    const root: TableOfContentsEntry[] = [];
    const stack: TableOfContentsEntry[] = [];

    for (const entry of entries) {
      while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(entry);
      } else {
        stack[stack.length - 1].children.push(entry);
      }

      stack.push(entry);
    }

    return root;
  }

  getRenderedContent(): string {
    return this.renderedContent;
  }

  getCurrentScrollPosition(): number {
    return this.currentScrollPosition;
  }

  getHighlightedSection(): string | null {
    return this.highlightedSectionId;
  }
}
