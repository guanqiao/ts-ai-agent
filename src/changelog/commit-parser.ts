import {
  ICommitParser,
  ConventionalCommit,
  RawCommit,
  ChangeType,
  CommitFooter,
  DEFAULT_CHANGELOG_CONFIG,
} from './types';

export class CommitParser implements ICommitParser {
  private typePatterns: RegExp[];
  private excludePatterns: RegExp[];

  constructor() {
    this.typePatterns = this.buildTypePatterns();
    this.excludePatterns = DEFAULT_CHANGELOG_CONFIG.excludePatterns.map(
      (p) => (typeof p === 'string' ? new RegExp(p, 'i') : p)
    );
  }

  parse(message: string, hash: string, author: string, date: Date): ConventionalCommit {
    const result: ConventionalCommit = {
      type: 'chore',
      description: message.split('\n')[0],
      raw: message,
      hash,
      author,
      date,
    };

    for (const pattern of this.excludePatterns) {
      if (pattern.test(message)) {
        return result;
      }
    }

    const conventionalMatch = this.parseConventionalCommit(message);
    if (conventionalMatch) {
      result.type = conventionalMatch.type || 'chore';
      result.scope = conventionalMatch.scope;
      result.description = conventionalMatch.description || result.description;
      result.body = conventionalMatch.body;
      result.breakingChange = conventionalMatch.breakingChange;
      result.breakingChangeNote = conventionalMatch.breakingChangeNote;
      result.issues = conventionalMatch.issues;
      result.footers = conventionalMatch.footers;
    }

    result.issues = result.issues || this.extractIssues(message);

    return result;
  }

  parseBatch(commits: RawCommit[]): ConventionalCommit[] {
    return commits.map((commit) => this.parse(commit.message, commit.hash, commit.author, commit.date));
  }

  private parseConventionalCommit(message: string): Partial<ConventionalCommit> | null {
    const lines = message.split('\n');
    const firstLine = lines[0];

    const headerPattern = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
    const match = firstLine.match(headerPattern);

    if (!match) {
      return null;
    }

    const [, typeStr, scope, breaking, description] = match;
    const type = this.normalizeType(typeStr);

    if (!type) {
      return null;
    }

    const result: Partial<ConventionalCommit> = {
      type,
      scope: scope || undefined,
      description: description.trim(),
      breakingChange: !!breaking,
    };

    if (lines.length > 1) {
      const bodyAndFooters = this.parseBodyAndFooters(lines.slice(1));
      result.body = bodyAndFooters.body;
      result.footers = bodyAndFooters.footers;

      if (bodyAndFooters.breakingChange) {
        result.breakingChange = true;
        result.breakingChangeNote = bodyAndFooters.breakingChangeNote;
      }
    }

    return result;
  }

  private parseBodyAndFooters(lines: string[]): {
    body?: string;
    footers: CommitFooter[];
    breakingChange?: boolean;
    breakingChangeNote?: string;
  } {
    const footers: CommitFooter[] = [];
    let bodyLines: string[] = [];
    let breakingChange = false;
    let breakingChangeNote: string | undefined;

    const footerPattern = /^([A-Za-z-]+):\s*(.+)$/;
    const breakingPattern = /^BREAKING[ -]CHANGE:\s*(.+)$/i;

    let inFooter = false;

    for (const line of lines) {
      if (line.trim() === '') {
        if (bodyLines.length > 0 && !inFooter) {
          bodyLines.push(line);
        }
        continue;
      }

      const breakingMatch = line.match(breakingPattern);
      if (breakingMatch) {
        breakingChange = true;
        breakingChangeNote = breakingMatch[1];
        inFooter = true;
        continue;
      }

      const footerMatch = line.match(footerPattern);
      if (footerMatch && (inFooter || bodyLines.length === 0)) {
        footers.push({
          key: footerMatch[1],
          value: footerMatch[2],
        });
        inFooter = true;
      } else if (!inFooter) {
        bodyLines.push(line);
      }
    }

    const body = bodyLines.join('\n').trim() || undefined;

    return {
      body,
      footers,
      breakingChange,
      breakingChangeNote,
    };
  }

  private normalizeType(typeStr: string): ChangeType | null {
    const typeMap: Record<string, ChangeType> = {
      feat: 'feat',
      feature: 'feat',
      fix: 'fix',
      bugfix: 'fix',
      docs: 'docs',
      documentation: 'docs',
      style: 'style',
      refactor: 'refactor',
      perf: 'perf',
      performance: 'perf',
      test: 'test',
      tests: 'test',
      build: 'build',
      ci: 'ci',
      chore: 'chore',
      revert: 'revert',
    };

    return typeMap[typeStr.toLowerCase()] || null;
  }

  private extractIssues(message: string): string[] {
    const issues: string[] = [];

    const patterns = [
      /#(\d+)/g,
      /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi,
      /([A-Z]+-\d+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const issue = match[1];
        if (!issues.includes(issue)) {
          issues.push(issue);
        }
      }
    }

    return issues;
  }

  private buildTypePatterns(): RegExp[] {
    const types: ChangeType[] = [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
      'revert',
    ];

    return types.map((type) => new RegExp(`^${type}(?:\\([^)]+\\))?!?:`, 'i'));
  }

  isConventional(message: string): boolean {
    return this.typePatterns.some((pattern) => pattern.test(message));
  }

  extractBreakingChanges(commit: ConventionalCommit): string | undefined {
    if (commit.breakingChangeNote) {
      return commit.breakingChangeNote;
    }

    if (commit.body && commit.body.includes('BREAKING CHANGE')) {
      const match = commit.body.match(/BREAKING[ -]CHANGE:\s*(.+?)(?:\n\n|$)/is);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  getCommitType(message: string): ChangeType {
    const parsed = this.parse(message, '', '', new Date());
    return parsed.type;
  }

  getCommitScope(message: string): string | undefined {
    const parsed = this.parse(message, '', '', new Date());
    return parsed.scope;
  }

  isBreakingChange(commit: ConventionalCommit): boolean {
    return commit.breakingChange || !!commit.breakingChangeNote;
  }
}
