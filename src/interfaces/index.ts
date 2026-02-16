import {
  Language,
  ParserOptions,
  ParsedFile,
  ParseResult,
  GeneratorOptions,
  GeneratedDocument,
  DocumentFormat,
  AgentContext,
  AgentResult,
  AgentMessage,
  LLMConfig,
} from '../types';

export {
  Language,
  ParserOptions,
  ParsedFile,
  ParseResult,
  GeneratorOptions,
  GeneratedDocument,
  DocumentFormat,
  AgentContext,
  AgentResult,
  AgentMessage,
  LLMConfig,
};

export interface IParser {
  readonly language: Language;
  parse(filePath: string, options?: ParserOptions): Promise<ParsedFile>;
  parseDirectory(dirPath: string, options?: ParserOptions): Promise<ParseResult>;
  isSupported(filePath: string): boolean;
}

export interface IGenerator {
  generate(parsedFiles: ParsedFile[], options: GeneratorOptions): Promise<GeneratedDocument>;
  getSupportedFormats(): DocumentFormat[];
}

export interface IAgent {
  readonly name: string;
  execute(context: AgentContext): Promise<AgentResult>;
}

export interface ILLMProvider {
  complete(messages: AgentMessage[], options?: Partial<LLMConfig>): Promise<string>;
  stream(messages: AgentMessage[], options?: Partial<LLMConfig>): AsyncIterable<string>;
}

export interface ITemplateEngine {
  render(template: string, context: Record<string, unknown>): string;
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
  loadTemplate(name: string): Promise<string>;
}
