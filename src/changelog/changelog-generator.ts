import {
  IChangelogGenerator,
  Changelog,
  ChangelogVersion,
  ChangelogSection,
  ChangelogEntry,
  ChangelogConfig,
  DEFAULT_CHANGELOG_CONFIG,
  ConventionalCommit,
  ChangeType,
  CHANGE_TYPE_ORDER,
} from './types';

export class ChangelogGenerator implements IChangelogGenerator {
  private config: ChangelogConfig;

  constructor(config?: Partial<ChangelogConfig>) {
    this.config = { ...DEFAULT_CHANGELOG_CONFIG, ...config };
  }

  async generate(commits: ConventionalCommit[], config?: Partial<ChangelogConfig>): Promise<Changelog> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    const filteredCommits = this.filterCommits(commits, effectiveConfig);
    const versions = this.groupByVersion(filteredCommits);
    const unreleased = this.groupByType(
      filteredCommits.filter((c) => !this.hasVersion(c))
    );

    const changelog: Changelog = {
      title: effectiveConfig.title,
      description: effectiveConfig.description,
      versions: versions.slice(0, effectiveConfig.maxVersions),
      unreleased,
      generatedAt: new Date(),
    };

    return changelog;
  }

  async generateForVersion(commits: ConventionalCommit[], version: string): Promise<ChangelogVersion> {
    const filteredCommits = this.filterCommits(commits, this.config);
    const sections = this.groupByType(filteredCommits);

    return {
      version,
      date: new Date(),
      sections,
      summary: this.generateSummary(filteredCommits),
    };
  }

  private filterCommits(commits: ConventionalCommit[], config: ChangelogConfig): ConventionalCommit[] {
    return commits.filter((commit) => {
      for (const pattern of config.excludePatterns) {
        if (typeof pattern === 'string') {
          if (commit.description.toLowerCase().includes(pattern.toLowerCase())) {
            return false;
          }
        } else {
          if (pattern.test(commit.description)) {
            return false;
          }
        }
      }

      const typeConfig = config.types.find((t) => t.type === commit.type);
      if (typeConfig && !typeConfig.showInChangelog) {
        return false;
      }

      return true;
    });
  }

  private groupByVersion(commits: ConventionalCommit[]): ChangelogVersion[] {
    const versionMap = new Map<string, ConventionalCommit[]>();

    for (const commit of commits) {
      const version = this.extractVersion(commit) || 'unreleased';
      if (!versionMap.has(version)) {
        versionMap.set(version, []);
      }
      versionMap.get(version)!.push(commit);
    }

    const versions: ChangelogVersion[] = [];

    for (const [version, versionCommits] of versionMap) {
      if (version === 'unreleased') continue;

      const sections = this.groupByType(versionCommits);
      versions.push({
        version,
        date: this.getVersionDate(versionCommits),
        sections,
        summary: this.generateSummary(versionCommits),
      });
    }

    versions.sort((a, b) => {
      const versionA = this.parseVersion(a.version);
      const versionB = this.parseVersion(b.version);
      return versionB - versionA;
    });

    return versions;
  }

  private groupByType(commits: ConventionalCommit[]): ChangelogSection[] {
    const typeMap = new Map<ChangeType, ChangelogEntry[]>();

    for (const commit of commits) {
      if (!typeMap.has(commit.type)) {
        typeMap.set(commit.type, []);
      }

      const entry: ChangelogEntry = {
        type: commit.type,
        scope: commit.scope,
        breaking: commit.breakingChange || false,
        description: commit.description,
        commit: {
          hash: commit.hash,
          shortHash: commit.hash.substring(0, 7),
        },
        issues: commit.issues,
      };

      typeMap.get(commit.type)!.push(entry);
    }

    const sections: ChangelogSection[] = [];

    for (const type of CHANGE_TYPE_ORDER) {
      const entries = typeMap.get(type);
      if (entries && entries.length > 0) {
        const typeConfig = this.config.types.find((t) => t.type === type);
        sections.push({
          type,
          title: typeConfig?.title || type,
          entries,
        });
      }
    }

    return sections;
  }

  private hasVersion(commit: ConventionalCommit): boolean {
    return commit.raw.includes('release') || /\d+\.\d+\.\d+/.test(commit.raw);
  }

  private extractVersion(commit: ConventionalCommit): string | null {
    const versionMatch = commit.raw.match(/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : null;
  }

  private getVersionDate(commits: ConventionalCommit[]): Date {
    if (commits.length === 0) return new Date();

    const dates = commits.map((c) => c.date.getTime());
    return new Date(Math.max(...dates));
  }

  private parseVersion(version: string): number {
    const parts = version.split('.').map((p) => parseInt(p, 10) || 0);
    return parts[0] * 10000 + parts[1] * 100 + parts[2];
  }

  private generateSummary(commits: ConventionalCommit[]): string {
    const featCount = commits.filter((c) => c.type === 'feat').length;
    const fixCount = commits.filter((c) => c.type === 'fix').length;
    const breakingCount = commits.filter((c) => c.breakingChange).length;

    const parts: string[] = [];

    if (featCount > 0) {
      parts.push(`${featCount} new feature${featCount > 1 ? 's' : ''}`);
    }

    if (fixCount > 0) {
      parts.push(`${fixCount} bug fix${fixCount > 1 ? 'es' : ''}`);
    }

    if (breakingCount > 0) {
      parts.push(`${breakingCount} breaking change${breakingCount > 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? `This release includes ${parts.join(', ')}.` : '';
  }

  toMarkdown(changelog: Changelog): string {
    const lines: string[] = [];

    lines.push(`# ${changelog.title}`);
    lines.push('');

    if (changelog.description) {
      lines.push(changelog.description);
      lines.push('');
    }

    if (changelog.unreleased.length > 0 && this.config.includeUnreleased) {
      lines.push('## [Unreleased]');
      lines.push('');

      for (const section of changelog.unreleased) {
        lines.push(`### ${section.title}`);
        lines.push('');

        for (const entry of section.entries) {
          lines.push(this.formatEntry(entry));
        }

        lines.push('');
      }
    }

    for (const version of changelog.versions) {
      const dateStr = version.date.toISOString().split('T')[0];
      lines.push(`## [${version.version}] - ${dateStr}`);
      lines.push('');

      if (version.summary) {
        lines.push(`> ${version.summary}`);
        lines.push('');
      }

      for (const section of version.sections) {
        lines.push(`### ${section.title}`);
        lines.push('');

        for (const entry of section.entries) {
          lines.push(this.formatEntry(entry));
        }

        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }

  private formatEntry(entry: ChangelogEntry): string {
    let line = '- ';

    if (entry.breaking) {
      line += '**BREAKING** ';
    }

    if (entry.scope) {
      line += `**${entry.scope}:** `;
    }

    line += entry.description;

    if (this.config.includeCommitLinks && entry.commit.shortHash) {
      line += ` (${entry.commit.shortHash})`;
    }

    if (this.config.includeIssueLinks && entry.issues && entry.issues.length > 0) {
      line += `, closes ${entry.issues.map((i) => `#${i}`).join(', ')}`;
    }

    return line;
  }

  setConfig(config: Partial<ChangelogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ChangelogConfig {
    return { ...this.config };
  }
}
