export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  description?: string;
  location: CodeLocation;
  signature?: string;
  type?: string;
  modifiers?: string[];
  decorators?: DecoratorInfo[];
  documentation?: string;
  parameters?: ParameterInfo[];
  returnType?: string;
  generics?: GenericInfo[];
  extends?: string[];
  implements?: string[];
  members?: CodeSymbol[];
  dependencies?: DependencyInfo[];
}

export enum SymbolKind {
  Class = 'class',
  Interface = 'interface',
  Function = 'function',
  Method = 'method',
  Property = 'property',
  Variable = 'variable',
  Constant = 'constant',
  Enum = 'enum',
  EnumMember = 'enum-member',
  TypeAlias = 'type-alias',
  Namespace = 'namespace',
  Module = 'module',
  Constructor = 'constructor',
  Field = 'field',
  Annotation = 'annotation',
  Package = 'package',
}

export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DecoratorInfo {
  name: string;
  arguments?: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface GenericInfo {
  name: string;
  constraint?: string;
  default?: string;
}

export interface DependencyInfo {
  name: string;
  path: string;
  kind: 'import' | 'export' | 'usage';
  isExternal?: boolean;
}

export interface ParsedFile {
  path: string;
  language: Language;
  symbols: CodeSymbol[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  rawContent?: string;
  parseTime?: number;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isExternal: boolean;
}

export interface ExportInfo {
  name: string;
  kind: SymbolKind;
  isDefault: boolean;
}

export enum Language {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  Java = 'java',
  Python = 'python',
}

export interface ParseResult {
  files: ParsedFile[];
  summary: ParseSummary;
  errors: ParseError[];
}

export interface ParseSummary {
  totalFiles: number;
  totalSymbols: number;
  byKind: Record<SymbolKind, number>;
  byLanguage: Record<Language, number>;
  parseTime: number;
}

export interface ParseError {
  file: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface ParserOptions {
  includePrivate?: boolean;
  includeInternal?: boolean;
  includeNodeModules?: boolean;
  maxFileSize?: number;
  encoding?: BufferEncoding;
  excludePatterns?: string[];
  includePatterns?: string[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number;
  subsections?: DocumentSection[];
  metadata?: Record<string, unknown>;
}

export interface GeneratedDocument {
  title: string;
  description?: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
  format: DocumentFormat;
  raw: string;
}

export interface DocumentMetadata {
  generatedAt: Date;
  generator: string;
  version: string;
  sourceFiles: string[];
  language: Language;
  template?: string;
}

export enum DocumentFormat {
  Markdown = 'markdown',
  HTML = 'html',
  Confluence = 'confluence',
  GitHubWiki = 'github-wiki',
}

export interface DocumentTemplate {
  name: string;
  description: string;
  sections: TemplateSection[];
  variables?: Record<string, string>;
}

export interface TemplateSection {
  id: string;
  title: string;
  template: string;
  required: boolean;
  order: number;
}

export interface AgentContext {
  parsedFiles: ParsedFile[];
  options: GeneratorOptions;
  workingDirectory: string;
  cache?: Map<string, unknown>;
}

export interface GeneratorOptions {
  input: string[];
  output: string;
  language?: Language;
  format?: DocumentFormat;
  template?: string;
  llmProvider?: LLMProvider;
  llmModel?: string;
  includePrivate?: boolean;
  generateDiagrams?: boolean;
  generateExamples?: boolean;
  maxTokens?: number;
  temperature?: number;
  verbose?: boolean;
}

export enum LLMProvider {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Local = 'local',
  Azure = 'azure',
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}
