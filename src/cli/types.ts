import { Language, DocumentFormat, LLMProvider } from '../types';

export interface BaseCommandOptions {
  verbose?: boolean;
}

export interface GenerateCommandOptions extends BaseCommandOptions {
  output: string;
  language: Language;
  format: DocumentFormat;
  template: string;
  llm: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  caCert?: string;
  includePrivate: boolean;
  dryRun: boolean;
}

export interface ParseCommandOptions extends BaseCommandOptions {
  output?: string;
  language: Language;
  format: 'json' | 'yaml' | 'markdown';
  includePrivate: boolean;
}

export interface WikiCommandOptions extends BaseCommandOptions {
  output: string;
  format: DocumentFormat;
  llm: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  caCert?: string;
  watch: boolean;
  query?: string;
  search?: string;
  maxResults: number;
  syncStart: boolean;
  syncStop: boolean;
  syncStatus: boolean;
  showConfig: boolean;
  resetConfig: boolean;
  sharePath: string;
  shareAccess: 'public' | 'team' | 'private';
  graphType: 'dependency' | 'call' | 'inheritance';
  graphFormat: 'mermaid' | 'svg' | 'json';
  adrTitle?: string;
  adrContext?: string;
  adrDecision?: string;
  adrStatus: 'proposed' | 'accepted' | 'deprecated';
  adrId?: string;
  collabUser?: string;
  collabRole: 'admin' | 'editor' | 'viewer';
  impactFile?: string;
  impactType: 'added' | 'modified' | 'removed';
  incremental: boolean;
  force: boolean;
}

export type CLIOptions = GenerateCommandOptions | ParseCommandOptions | WikiCommandOptions;

export function parseLanguage(value: string): Language {
  const languages: Record<string, Language> = {
    typescript: Language.TypeScript,
    ts: Language.TypeScript,
    javascript: Language.TypeScript,
    js: Language.TypeScript,
    java: Language.Java,
  };
  return languages[value.toLowerCase()] || Language.TypeScript;
}

export function parseFormat(value: string): DocumentFormat {
  const formats: Record<string, DocumentFormat> = {
    markdown: DocumentFormat.Markdown,
    md: DocumentFormat.Markdown,
    confluence: DocumentFormat.Confluence,
    'github-wiki': DocumentFormat.GitHubWiki,
    github: DocumentFormat.GitHubWiki,
  };
  return formats[value.toLowerCase()] || DocumentFormat.Markdown;
}

export function parseLLMProvider(value: string): LLMProvider {
  const providers: Record<string, LLMProvider> = {
    openai: LLMProvider.OpenAI,
    anthropic: LLMProvider.Anthropic,
    claude: LLMProvider.Anthropic,
  };
  return providers[value.toLowerCase()] || LLMProvider.OpenAI;
}
