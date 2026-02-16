import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Language } from '../types';
import {
  IExampleExtractor,
  CodeExample,
  ExampleExtractionConfig,
  DEFAULT_EXTRACTION_CONFIG,
  TestFileInfo,
} from './types';
import { TestParser } from './test-parser';

export class ExampleExtractor implements IExampleExtractor {
  private config: ExampleExtractionConfig;
  private testParser: TestParser;

  constructor(config?: Partial<ExampleExtractionConfig>) {
    this.config = { ...DEFAULT_EXTRACTION_CONFIG, ...config };
    this.testParser = new TestParser();
  }

  async extract(
    files: string[],
    config?: Partial<ExampleExtractionConfig>
  ): Promise<CodeExample[]> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;
    const examples: CodeExample[] = [];

    for (const file of files) {
      if (this.shouldExclude(file, effectiveConfig)) continue;

      const fileExamples = await this.extractFromFile(file, effectiveConfig);
      examples.push(...fileExamples);
    }

    return examples;
  }

  extractFromTest(testFile: TestFileInfo): CodeExample[] {
    const examples: CodeExample[] = [];

    for (const test of testFile.testFunctions) {
      if (test.isSkipped) continue;
      if (test.code.split('\n').length < this.config.minLines) continue;

      const example: CodeExample = {
        id: this.generateId(),
        title: this.generateTestTitle(test.name, test.description),
        description: test.description,
        code: this.cleanTestCode(test.code),
        language: testFile.language,
        source: {
          type: 'test',
          filePath: testFile.path,
          lineStart: test.lineStart,
          lineEnd: test.lineEnd,
          testName: test.name,
        },
        tags: this.extractTags(test),
        relatedSymbols: this.extractRelatedSymbols(test.code),
        output: test.expectedOutput,
        complexity: this.determineComplexity(test.code),
      };

      examples.push(example);
    }

    return examples;
  }

  async extractFromSource(sourceFile: string): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];

    if (!fs.existsSync(sourceFile)) return examples;

    const content = fs.readFileSync(sourceFile, 'utf-8');
    const language = this.detectLanguage(sourceFile);

    const commentExamples = this.extractFromComments(content, sourceFile, language);
    examples.push(...commentExamples);

    const docStringExamples = this.extractFromDocStrings(content, sourceFile, language);
    examples.push(...docStringExamples);

    return examples;
  }

  private async extractFromFile(
    filePath: string,
    config: ExampleExtractionConfig
  ): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];
    const language = this.detectLanguage(filePath);

    if (!config.languages.includes(language)) {
      return examples;
    }

    const isTestFile = this.isTestFile(filePath);

    if (isTestFile && config.includeTests) {
      const testInfo = await this.testParser.parse(filePath);
      const testExamples = this.extractFromTest(testInfo);
      examples.push(...testExamples);
    }

    if (config.includeComments || config.includeDocStrings) {
      const sourceExamples = await this.extractFromSource(filePath);
      examples.push(...sourceExamples);
    }

    return examples;
  }

  private extractFromComments(
    content: string,
    filePath: string,
    language: Language
  ): CodeExample[] {
    const examples: CodeExample[] = [];

    const examplePatterns = [
      /\/\/\s*Example:\s*(.+?)\n([\s\S]*?)(?=\/\/\s*Example:|$)/gi,
      /\/\*\s*Example:\s*(.+?)\n([\s\S]*?)\*\//gi,
      /#\s*Example:\s*(.+?)\n([\s\S]*?)(?=#\s*Example:|$)/gi,
    ];

    for (const pattern of examplePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const title = match[1].trim();
        const code = match[2].trim();

        if (code.split('\n').length >= this.config.minLines) {
          const lineStart = content.substring(0, match.index).split('\n').length;

          examples.push({
            id: this.generateId(),
            title,
            code: this.cleanCode(code),
            language,
            source: {
              type: 'documentation',
              filePath,
              lineStart,
              lineEnd: lineStart + code.split('\n').length,
            },
            tags: [],
            relatedSymbols: this.extractRelatedSymbols(code),
            complexity: this.determineComplexity(code),
          });
        }
      }
    }

    return examples;
  }

  private extractFromDocStrings(
    content: string,
    filePath: string,
    language: Language
  ): CodeExample[] {
    const examples: CodeExample[] = [];

    const docStringPattern = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = docStringPattern.exec(content)) !== null) {
      const codeLang = match[1] || language;
      const code = match[2].trim();

      if (code.split('\n').length >= this.config.minLines) {
        const lineStart = content.substring(0, match.index).split('\n').length;

        examples.push({
          id: this.generateId(),
          title: 'Code Example',
          code,
          language: codeLang,
          source: {
            type: 'documentation',
            filePath,
            lineStart,
            lineEnd: lineStart + code.split('\n').length,
          },
          tags: [],
          relatedSymbols: this.extractRelatedSymbols(code),
          complexity: this.determineComplexity(code),
        });
      }
    }

    return examples;
  }

  private shouldExclude(filePath: string, config: ExampleExtractionConfig): boolean {
    for (const pattern of config.excludePatterns) {
      if (filePath.includes(pattern)) return true;
    }
    return false;
  }

  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\.(ts|js|tsx|jsx|py)$/,
      /\.spec\.(ts|js|tsx|jsx|py)$/,
      /_test\.(ts|js|tsx|jsx|py)$/,
      /__tests__\//,
    ];

    return testPatterns.some((p) => p.test(filePath));
  }

  private detectLanguage(filePath: string): Language {
    const ext = path.extname(filePath);
    const langMap: Record<string, Language> = {
      '.ts': Language.TypeScript,
      '.tsx': Language.TypeScript,
      '.js': Language.JavaScript,
      '.jsx': Language.JavaScript,
      '.py': Language.Python,
      '.java': Language.Java,
    };

    return langMap[ext] || Language.TypeScript;
  }

  private generateTestTitle(testName: string, description?: string): string {
    if (description) return description;

    return testName
      .replace(/^(test|it|describe)\s*['"`]([^'"`]+)['"`].*/i, '$2')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  private cleanTestCode(code: string): string {
    let cleaned = code;

    cleaned = cleaned.replace(
      /^(test|it|describe)\s*\(['"`][^'"`]+['"`],\s*(async\s*)?\(\s*\)\s*=>\s*\{?\n?/gm,
      ''
    );
    cleaned = cleaned.replace(/\}\);?\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\}\s*$/gm, '');

    const lines = cleaned.split('\n');
    const minIndent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => l.match(/^(\s*)/)?.[1].length || 0)
    );

    cleaned = lines.map((l) => l.substring(minIndent)).join('\n');

    return cleaned.trim();
  }

  private cleanCode(code: string): string {
    return code.trim();
  }

  private extractTags(test: { code: string; assertions: string[] }): string[] {
    const tags: string[] = [];

    if (test.code.includes('async') || test.code.includes('await')) {
      tags.push('async');
    }

    if (test.code.includes('mock') || test.code.includes('Mock')) {
      tags.push('mocking');
    }

    if (test.assertions.length > 3) {
      tags.push('comprehensive');
    }

    return tags;
  }

  private extractRelatedSymbols(code: string): string[] {
    const symbols: string[] = [];

    const functionPattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      const symbol = match[1];
      if (
        !symbols.includes(symbol) &&
        !['Promise', 'Array', 'Object', 'String', 'Number', 'Boolean'].includes(symbol)
      ) {
        symbols.push(symbol);
      }
    }

    return symbols.slice(0, 5);
  }

  private determineComplexity(code: string): 'basic' | 'intermediate' | 'advanced' {
    const lines = code.split('\n').length;
    const hasAsync = code.includes('async') || code.includes('await');
    const hasClasses = code.includes('class ');
    const hasGenerics = code.includes('<') && code.includes('>');
    const hasComplexPatterns =
      code.includes('Promise') || code.includes('Observable') || code.includes('EventEmitter');

    let score = 0;
    if (lines > 20) score += 1;
    if (lines > 50) score += 1;
    if (hasAsync) score += 1;
    if (hasClasses) score += 1;
    if (hasGenerics) score += 1;
    if (hasComplexPatterns) score += 1;

    if (score <= 1) return 'basic';
    if (score <= 3) return 'intermediate';
    return 'advanced';
  }

  private generateId(): string {
    return `example-${crypto.randomBytes(4).toString('hex')}`;
  }

  setConfig(config: Partial<ExampleExtractionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ExampleExtractionConfig {
    return { ...this.config };
  }
}
