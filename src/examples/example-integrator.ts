import * as fs from 'fs';
import {
  IExampleIntegrator,
  CodeExample,
  ExampleGroup,
} from './types';

export class ExampleIntegrator implements IExampleIntegrator {
  async integrate(examples: CodeExample[], documentPath: string): Promise<void> {
    if (!fs.existsSync(documentPath)) {
      throw new Error(`Document not found: ${documentPath}`);
    }

    let content = fs.readFileSync(documentPath, 'utf-8');

    const exampleSection = this.generateExampleSection(examples);

    const exampleMarkerRegex = /<!--\s*EXAMPLES\s*-->/i;

    if (exampleMarkerRegex.test(content)) {
      content = content.replace(exampleMarkerRegex, exampleSection);
    } else {
      const sections = content.split(/^## /m);
      if (sections.length > 1) {
        sections.splice(1, 0, exampleSection.replace(/^## /, ''));
        content = sections.join('## ');
      } else {
        content += '\n\n' + exampleSection;
      }
    }

    fs.writeFileSync(documentPath, content);
  }

  generateExampleSection(examples: CodeExample[]): string {
    if (examples.length === 0) {
      return '';
    }

    const groups = this.groupExamples(examples);
    const lines: string[] = [];

    lines.push('## Examples');
    lines.push('');

    for (const group of groups) {
      lines.push(`### ${group.name}`);
      lines.push('');

      if (group.description) {
        lines.push(group.description);
        lines.push('');
      }

      for (const example of group.examples) {
        lines.push(this.formatExample(example));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private groupExamples(examples: CodeExample[]): ExampleGroup[] {
    const groups: Map<string, ExampleGroup> = new Map();

    const complexityOrder = ['basic', 'intermediate', 'advanced'];

    const sortedExamples = [...examples].sort((a, b) => {
      const aIndex = complexityOrder.indexOf(a.complexity);
      const bIndex = complexityOrder.indexOf(b.complexity);
      return aIndex - bIndex;
    });

    for (const example of sortedExamples) {
      const groupName = this.determineGroupName(example);

      if (!groups.has(groupName)) {
        groups.set(groupName, {
          name: groupName,
          examples: [],
        });
      }

      groups.get(groupName)!.examples.push(example);
    }

    return Array.from(groups.values());
  }

  private determineGroupName(example: CodeExample): string {
    if (example.tags.includes('async')) {
      return 'Async Usage';
    }

    if (example.tags.includes('mocking')) {
      return 'With Mocking';
    }

    switch (example.complexity) {
      case 'basic':
        return 'Basic Usage';
      case 'intermediate':
        return 'Intermediate Examples';
      case 'advanced':
        return 'Advanced Examples';
      default:
        return 'Examples';
    }
  }

  private formatExample(example: CodeExample): string {
    const lines: string[] = [];

    lines.push(`#### ${example.title}`);
    lines.push('');

    if (example.description) {
      lines.push(example.description);
      lines.push('');
    }

    lines.push('```' + this.getLanguageTag(example.language));
    lines.push(example.code);
    lines.push('```');

    if (example.output) {
      lines.push('');
      lines.push('**Output:**');
      lines.push('```');
      lines.push(example.output);
      lines.push('```');
    }

    if (example.explanation) {
      lines.push('');
      lines.push(`> ${example.explanation}`);
    }

    if (example.source.type === 'test') {
      lines.push('');
      lines.push(`*Source: ${example.source.testName || 'test'}*`);
    }

    return lines.join('\n');
  }

  private getLanguageTag(language: string): string {
    const langMap: Record<string, string> = {
      typescript: 'typescript',
      javascript: 'javascript',
      python: 'python',
      java: 'java',
      go: 'go',
      rust: 'rust',
    };

    return langMap[language.toLowerCase()] || language.toLowerCase();
  }

  generateExamplePage(examples: CodeExample[], title: string = 'Code Examples'): string {
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push('');
    lines.push('This page contains code examples demonstrating various use cases.');
    lines.push('');

    const section = this.generateExampleSection(examples);
    lines.push(section.replace(/^## /, ''));

    return lines.join('\n');
  }

  generateExampleIndex(examples: CodeExample[]): string {
    const lines: string[] = [];

    lines.push('# Examples Index');
    lines.push('');

    const bySymbol = new Map<string, CodeExample[]>();

    for (const example of examples) {
      for (const symbol of example.relatedSymbols) {
        if (!bySymbol.has(symbol)) {
          bySymbol.set(symbol, []);
        }
        bySymbol.get(symbol)!.push(example);
      }
    }

    for (const [symbol, symbolExamples] of bySymbol) {
      lines.push(`## ${symbol}`);
      lines.push('');

      for (const example of symbolExamples) {
        lines.push(`- [${example.title}](#${this.slugify(example.title)}) (${example.complexity})`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  extractExamplesFromMarkdown(content: string): CodeExample[] {
    const examples: CodeExample[] = [];

    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = codeBlockPattern.exec(content)) !== null) {
      const language = match[1] || 'typescript';
      const code = match[2].trim();

      const precedingText = content.substring(Math.max(0, match.index - 200), match.index);
      const titleMatch = precedingText.match(/(?:###|####)\s+(.+?)(?:\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : `Example ${index + 1}`;

      examples.push({
        id: `md-example-${index}`,
        title,
        code,
        language,
        source: {
          type: 'documentation',
          filePath: '',
          lineStart: 0,
          lineEnd: 0,
        },
        tags: [],
        relatedSymbols: [],
        complexity: 'intermediate',
      });

      index++;
    }

    return examples;
  }
}
