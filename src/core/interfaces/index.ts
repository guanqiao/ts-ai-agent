import {
  Language,
  DocumentFormat,
  ParsedFile,
  ParseResult,
  ParserOptions,
  GeneratedDocument,
  GeneratorOptions,
  AgentContext,
  AgentResult,
  AgentMessage,
  LLMConfig,
} from '../../types';
import { WikiDocument } from '../../wiki/types';
import { ChangeSet } from '../../sync/types';

export interface ILLMProvider {
  complete(messages: AgentMessage[], options?: Partial<LLMConfig>): Promise<string>;
  stream(messages: AgentMessage[], options?: Partial<LLMConfig>): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
  getModel(): string;
}

export interface IAgent {
  readonly name: string;
  execute(context: AgentContext): Promise<AgentResult>;
}

export interface IWikiManager {
  initialize(projectPath: string, options: import('../../wiki/types').WikiOptions, user?: string): Promise<void>;
  generate(context: import('../../wiki/types').WikiContext): Promise<WikiDocument>;
  update(changeSet: ChangeSet): Promise<void>;
  query(question: string): Promise<import('../../wiki/types').WikiAnswer>;
  export(format: DocumentFormat): Promise<string>;
  watch(callback: import('../../wiki/types').WikiEventCallback): void;
  stopWatching(): void;
  getPage(pageId: string): Promise<import('../../wiki/types').WikiPage | null>;
  listPages(): Promise<import('../../wiki/types').WikiPage[]>;
  deletePage(pageId: string): Promise<void>;
}

export interface IWikiStorage {
  save(document: WikiDocument): Promise<void>;
  load(projectPath: string): Promise<WikiDocument | null>;
  savePage(page: import('../../wiki/types').WikiPage): Promise<void>;
  loadPage(pageId: string): Promise<import('../../wiki/types').WikiPage | null>;
  deletePage(pageId: string): Promise<void>;
  listPages(): Promise<import('../../wiki/types').WikiPage[]>;
  exists(): Promise<boolean>;
}

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

export interface ITemplateEngine {
  render(template: string, context: Record<string, unknown>): string;
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
  loadTemplate(name: string): Promise<string>;
}

export interface IArchitectureAnalyzer {
  analyze(parsedFiles: ParsedFile[]): Promise<import('../../architecture/types').ArchitectureReport>;
}

export interface IKnowledgeBase {
  index(document: WikiDocument): Promise<void>;
  query(question: string): Promise<import('../../wiki/types').WikiAnswer>;
  search(keywords: string[]): Promise<import('../../wiki/types').WikiPage[]>;
  getRelatedPages(pageId: string): Promise<import('../../wiki/types').WikiPage[]>;
  getContext(topic: string): Promise<string>;
}

export interface IVectorStore {
  initialize(): Promise<void>;
  addDocument(doc: import('../../wiki/types').VectorDocument): Promise<void>;
  addDocuments(docs: import('../../wiki/types').VectorDocument[]): Promise<void>;
  removeDocument(id: string): Promise<void>;
  search(query: string, k: number): Promise<import('../../wiki/types').SearchResult[]>;
  similaritySearch(embedding: number[], k: number): Promise<import('../../wiki/types').SearchResult[]>;
  getDocumentCount(): number;
  clear(): Promise<void>;
}

export interface IHybridSearch {
  search(query: string, options: import('../../wiki/types').HybridSearchOptions): Promise<import('../../wiki/types').SearchResult[]>;
  indexDocument(doc: import('../../wiki/types').VectorDocument): Promise<void>;
  removeDocument(docId: string): Promise<void>;
  reindex(): Promise<void>;
}

export interface IGitWatcher {
  start(callback: (event: import('../../git/types').GitWatcherEvent) => void | Promise<void>): void;
  stop(): void;
}

export interface IIncrementalUpdater {
  createSnapshot(parsedFiles: ParsedFile[], commitHash: string): import('../../sync/types').Snapshot;
  saveSnapshot(snapshot: import('../../sync/types').Snapshot): Promise<void>;
  loadLatestSnapshot(): Promise<import('../../sync/types').Snapshot | null>;
  mergeContent(oldContent: string, newContent: string, changeType: string): string;
}

export {
  Language,
  DocumentFormat,
  ParsedFile,
  ParseResult,
  ParserOptions,
  GeneratedDocument,
  GeneratorOptions,
  AgentContext,
  AgentResult,
  AgentMessage,
  LLMConfig,
};
