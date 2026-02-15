import { DocumentFormat, Language, ParsedFile } from '../types';
import { ArchitectureReport } from '../architecture/types';
import { ChangeSet } from '../sync/types';

export interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  format: DocumentFormat;
  metadata: WikiPageMetadata;
  sections: WikiSection[];
  links: WikiLink[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface WikiPageMetadata {
  author?: string;
  tags: string[];
  category: WikiCategory;
  sourceFiles: string[];
  language: Language;
  commitHash?: string;
  custom?: Record<string, unknown>;
}

export interface WikiSection {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
}

export interface WikiLink {
  text: string;
  target: string;
  type: 'internal' | 'external' | 'cross-reference';
}

export type WikiCategory =
  | 'overview'
  | 'architecture'
  | 'api'
  | 'guide'
  | 'reference'
  | 'changelog'
  | 'decision'
  | 'module';

export interface WikiDocument {
  id: string;
  name: string;
  description?: string;
  pages: WikiPage[];
  index: WikiIndex;
  metadata: WikiDocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiIndex {
  pages: WikiPageIndexEntry[];
  categories: WikiCategoryIndex[];
  searchIndex: WikiSearchEntry[];
}

export interface WikiPageIndexEntry {
  id: string;
  title: string;
  slug: string;
  category: WikiCategory;
  tags: string[];
  wordCount: number;
}

export interface WikiCategoryIndex {
  category: WikiCategory;
  pages: string[];
  description?: string;
}

export interface WikiSearchEntry {
  pageId: string;
  keywords: string[];
  summary: string;
}

export interface WikiDocumentMetadata {
  projectName: string;
  projectVersion?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  generator: string;
  generatorVersion: string;
  totalFiles: number;
  totalSymbols: number;
}

export interface WikiAnswer {
  question: string;
  answer: string;
  relatedPages: string[];
  confidence: number;
  sources: WikiAnswerSource[];
}

export interface WikiAnswerSource {
  pageId: string;
  pageTitle: string;
  relevance: number;
  excerpt?: string;
}

export interface WikiEvent {
  type: 'page-created' | 'page-updated' | 'page-deleted' | 'wiki-regenerated';
  pageId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export type WikiEventCallback = (event: WikiEvent) => void | Promise<void>;

export interface WikiOptions {
  outputDir: string;
  format: DocumentFormat;
  language?: Language;
  includePrivate?: boolean;
  generateIndex?: boolean;
  generateSearch?: boolean;
  watchMode?: boolean;
  autoUpdate?: boolean;
}

export interface WikiContext {
  projectPath: string;
  outputPath: string;
  parsedFiles: ParsedFile[];
  architecture?: ArchitectureReport;
  changeSet?: ChangeSet;
  options: WikiOptions;
}

export interface IWikiManager {
  initialize(projectPath: string, options: WikiOptions): Promise<void>;
  generate(context: WikiContext): Promise<WikiDocument>;
  update(changeSet: ChangeSet): Promise<void>;
  query(question: string): Promise<WikiAnswer>;
  export(format: DocumentFormat): Promise<string>;
  watch(callback: WikiEventCallback): void;
  stopWatching(): void;
  getPage(pageId: string): Promise<WikiPage | null>;
  listPages(): Promise<WikiPage[]>;
  deletePage(pageId: string): Promise<void>;
}

export interface IWikiStorage {
  save(document: WikiDocument): Promise<void>;
  load(projectPath: string): Promise<WikiDocument | null>;
  savePage(page: WikiPage): Promise<void>;
  loadPage(pageId: string): Promise<WikiPage | null>;
  deletePage(pageId: string): Promise<void>;
  listPages(): Promise<WikiPage[]>;
  exists(): Promise<boolean>;
}

export interface IWikiKnowledgeBase {
  index(document: WikiDocument): Promise<void>;
  query(question: string): Promise<WikiAnswer>;
  search(keywords: string[]): Promise<WikiPage[]>;
  getRelatedPages(pageId: string): Promise<WikiPage[]>;
  getContext(topic: string): Promise<string>;
}
