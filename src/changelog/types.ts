export type ChangeType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'revert';

export type ChangeScope = string;

export interface ConventionalCommit {
  type: ChangeType;
  scope?: ChangeScope;
  description: string;
  body?: string;
  breakingChange?: boolean;
  breakingChangeNote?: string;
  issues?: string[];
  footers?: CommitFooter[];
  raw: string;
  hash: string;
  author: string;
  date: Date;
}

export interface CommitFooter {
  key: string;
  value: string;
}

export interface ChangelogEntry {
  type: ChangeType;
  scope?: string;
  breaking: boolean;
  description: string;
  commit: CommitReference;
  issues?: string[];
}

export interface CommitReference {
  hash: string;
  shortHash: string;
  url?: string;
}

export interface ChangelogSection {
  type: ChangeType;
  title: string;
  entries: ChangelogEntry[];
}

export interface ChangelogVersion {
  version: string;
  date: Date;
  sections: ChangelogSection[];
  summary?: string;
  compareUrl?: string;
}

export interface Changelog {
  title: string;
  description?: string;
  versions: ChangelogVersion[];
  unreleased: ChangelogSection[];
  generatedAt: Date;
  repository?: RepositoryInfo;
}

export interface RepositoryInfo {
  name: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
}

export interface ChangelogConfig {
  title: string;
  description?: string;
  includeUnreleased: boolean;
  includeCommitLinks: boolean;
  includeIssueLinks: boolean;
  issueUrlTemplate?: string;
  commitUrlTemplate?: string;
  compareUrlTemplate?: string;
  types: ChangeTypeConfig[];
  excludePatterns: (string | RegExp)[];
  maxVersions: number;
}

export interface ChangeTypeConfig {
  type: ChangeType;
  title: string;
  showInChangelog: boolean;
  emoji?: string;
}

export interface VersionInfo {
  version: string;
  previousVersion?: string;
  commits: ConventionalCommit[];
  date: Date;
  tag?: string;
}

export interface IChangelogGenerator {
  generate(commits: ConventionalCommit[], config: ChangelogConfig): Promise<Changelog>;
  generateForVersion(commits: ConventionalCommit[], version: string): Promise<ChangelogVersion>;
}

export interface ICommitParser {
  parse(message: string, hash: string, author: string, date: Date): ConventionalCommit;
  parseBatch(commits: RawCommit[]): ConventionalCommit[];
}

export interface IVersionManager {
  getCurrentVersion(): Promise<string>;
  getVersions(): Promise<VersionInfo[]>;
  getVersionCommits(version: string): Promise<ConventionalCommit[]>;
  suggestNextVersion(commits: ConventionalCommit[]): Promise<string>;
}

export interface RawCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  parentHashes?: string[];
}

export const DEFAULT_CHANGELOG_CONFIG: ChangelogConfig = {
  title: 'Changelog',
  description: 'All notable changes to this project will be documented in this file.',
  includeUnreleased: true,
  includeCommitLinks: true,
  includeIssueLinks: true,
  types: [
    { type: 'feat', title: 'Features', showInChangelog: true, emoji: '✨' },
    { type: 'fix', title: 'Bug Fixes', showInChangelog: true, emoji: '🐛' },
    { type: 'perf', title: 'Performance Improvements', showInChangelog: true, emoji: '⚡' },
    { type: 'refactor', title: 'Code Refactoring', showInChangelog: true, emoji: '♻️' },
    { type: 'docs', title: 'Documentation', showInChangelog: true, emoji: '📚' },
    { type: 'test', title: 'Tests', showInChangelog: true, emoji: '✅' },
    { type: 'build', title: 'Build System', showInChangelog: false },
    { type: 'ci', title: 'Continuous Integration', showInChangelog: false },
    { type: 'chore', title: 'Chores', showInChangelog: false },
    { type: 'style', title: 'Styles', showInChangelog: false },
    { type: 'revert', title: 'Reverts', showInChangelog: true },
  ],
  excludePatterns: [/^merge/i, /^bump/i, /^release/i],
  maxVersions: 50,
};

export const CHANGE_TYPE_ORDER: ChangeType[] = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'style',
  'build',
  'ci',
  'chore',
  'revert',
];
