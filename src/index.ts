export { TypeScriptParser, JavaParser, BaseParser } from './parsers';
export { CodeAnalysisAgent, DocGeneratorAgent, ReviewAgent, AgentOrchestrator } from './agents';
export { LLMService, BaseAgent, SYSTEM_PROMPTS, PROMPT_TEMPLATES } from './llm';
export { DocumentGenerator, TemplateEngine, BUILTIN_TEMPLATES } from './generators';
export * from './types';
export * from './interfaces';

import { TypeScriptParser, JavaParser } from './parsers';
import { AgentOrchestrator } from './agents';
import {
  GeneratorOptions,
  LLMConfig,
  ParseResult,
  GeneratedDocument,
  Language,
  DocumentFormat,
  SymbolKind,
} from './types';
import * as fs from 'fs';

export class TSDGenerator {
  private tsParser: TypeScriptParser;
  private javaParser: JavaParser;
  private orchestrator: AgentOrchestrator | null = null;

  constructor(private llmConfig?: LLMConfig) {
    this.tsParser = new TypeScriptParser();
    this.javaParser = new JavaParser();
  }

  async parse(input: string, language: Language = Language.TypeScript): Promise<ParseResult> {
    const stat = fs.statSync(input);

    if (language === Language.Java) {
      return stat.isDirectory()
        ? await this.javaParser.parseDirectory(input)
        : this.wrapSingleFile(await this.javaParser.parse(input), Language.Java);
    }

    return stat.isDirectory()
      ? await this.tsParser.parseDirectory(input)
      : this.wrapSingleFile(await this.tsParser.parse(input), Language.TypeScript);
  }

  async generate(options: GeneratorOptions): Promise<GeneratedDocument> {
    if (!this.llmConfig) {
      throw new Error('LLM configuration required for document generation');
    }

    this.orchestrator = new AgentOrchestrator(this.llmConfig);

    const parseResults: ParseResult[] = [];
    for (const input of options.input) {
      const result = await this.parse(input, options.language);
      parseResults.push(result);
    }

    const allFiles = parseResults.flatMap((r) => r.files);

    const context = {
      parsedFiles: allFiles,
      options,
      workingDirectory: process.cwd(),
    };

    const result = await this.orchestrator.run(context);

    return {
      title: 'Technical Documentation',
      sections: [],
      metadata: {
        generatedAt: new Date(),
        generator: 'TSD-Generator',
        version: '1.0.0',
        sourceFiles: allFiles.map((f) => f.path),
        language: options.language || Language.TypeScript,
      },
      format: options.format || DocumentFormat.Markdown,
      raw: result.finalDocument,
    };
  }

  private wrapSingleFile(file: any, language: Language): ParseResult {
    return {
      files: [file],
      summary: {
        totalFiles: 1,
        totalSymbols: file.symbols.length,
        byKind: {} as Record<SymbolKind, number>,
        byLanguage: { [language]: 1 } as Record<Language, number>,
        parseTime: file.parseTime || 0,
      },
      errors: [],
    };
  }
}

export async function generateDocumentation(
  options: GeneratorOptions,
  llmConfig: LLMConfig
): Promise<string> {
  const generator = new TSDGenerator(llmConfig);
  const document = await generator.generate(options);
  return document.raw;
}
