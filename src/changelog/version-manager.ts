import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { IVersionManager, VersionInfo, ConventionalCommit } from './types';
import { CommitParser } from './commit-parser';

export class VersionManager implements IVersionManager {
  private projectPath: string;
  private parser: CommitParser;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.parser = new CommitParser();
  }

  async getCurrentVersion(): Promise<string> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version || '0.0.0';
      } catch {
        return '0.0.0';
      }
    }

    try {
      const tag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      }).trim();
      return tag.replace(/^v/, '');
    } catch {
      return '0.0.0';
    }
  }

  async getVersions(): Promise<VersionInfo[]> {
    const versions: VersionInfo[] = [];

    try {
      const tags = execSync('git tag --sort=-version:refname', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .filter((t) => t);

      for (const tag of tags.slice(0, 50)) {
        const version = tag.replace(/^v/, '');
        const commits = await this.getVersionCommits(version);

        if (commits.length > 0) {
          versions.push({
            version,
            tag,
            commits,
            date: commits[0].date,
          });
        }
      }
    } catch {
      // No tags found
    }

    return versions;
  }

  async getVersionCommits(version: string): Promise<ConventionalCommit[]> {
    try {
      const previousVersion = await this.getPreviousVersion(version);
      const range = previousVersion ? `v${previousVersion}..v${version}` : `v${version}`;

      const log = execSync(
        `git log ${range} --pretty=format:"%H%n%an%n%aD%n%B%n---COMMIT_END---"`,
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        }
      );

      const commits = this.parseGitLog(log);
      return commits;
    } catch {
      return [];
    }
  }

  async suggestNextVersion(commits: ConventionalCommit[]): Promise<string> {
    const currentVersion = await this.getCurrentVersion();
    const [major, minor, patch] = currentVersion.split('.').map((n) => parseInt(n, 10) || 0);

    const hasBreaking = commits.some((c) => c.breakingChange);
    const hasFeat = commits.some((c) => c.type === 'feat');
    const hasFix = commits.some((c) => c.type === 'fix');

    if (hasBreaking) {
      return `${major + 1}.0.0`;
    }

    if (hasFeat) {
      return `${major}.${minor + 1}.0`;
    }

    if (hasFix) {
      return `${major}.${minor}.${patch + 1}`;
    }

    return `${major}.${minor}.${patch + 1}`;
  }

  private async getPreviousVersion(version: string): Promise<string | null> {
    try {
      const tags = execSync('git tag --sort=-version:refname', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .filter((t) => t);

      const currentIndex = tags.findIndex((t) => t === `v${version}` || t === version);

      if (currentIndex >= 0 && currentIndex < tags.length - 1) {
        return tags[currentIndex + 1].replace(/^v/, '');
      }
    } catch {
      // No tags found
    }

    return null;
  }

  private parseGitLog(log: string): ConventionalCommit[] {
    const commits: ConventionalCommit[] = [];
    const commitBlocks = log.split('---COMMIT_END---').filter((b) => b.trim());

    for (const block of commitBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 4) continue;

      const hash = lines[0];
      const author = lines[1];
      const dateStr = lines[2];
      const message = lines.slice(3).join('\n').trim();

      const date = new Date(dateStr);

      const commit = this.parser.parse(message, hash, author, date);
      commits.push(commit);
    }

    return commits;
  }

  async getCommitsSinceLastRelease(): Promise<ConventionalCommit[]> {
    const currentVersion = await this.getCurrentVersion();

    try {
      const log = execSync(
        `git log v${currentVersion}..HEAD --pretty=format:"%H%n%an%n%aD%n%B%n---COMMIT_END---"`,
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        }
      );

      return this.parseGitLog(log);
    } catch {
      try {
        const log = execSync('git log --pretty=format:"%H%n%an%n%aD%n%B%n---COMMIT_END---"', {
          cwd: this.projectPath,
          encoding: 'utf-8',
        });

        return this.parseGitLog(log);
      } catch {
        return [];
      }
    }
  }

  async bumpVersion(type: 'major' | 'minor' | 'patch'): Promise<string> {
    const currentVersion = await this.getCurrentVersion();
    const [major, minor, patch] = currentVersion.split('.').map((n) => parseInt(n, 10) || 0);

    let newVersion: string;

    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      pkg.version = newVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    return newVersion;
  }

  async createVersionTag(version: string, message?: string): Promise<void> {
    const tag = `v${version}`;
    const tagMessage = message || `Release ${version}`;

    execSync(`git tag -a ${tag} -m "${tagMessage}"`, {
      cwd: this.projectPath,
    });
  }

  getVersionType(commits: ConventionalCommit[]): 'major' | 'minor' | 'patch' {
    const hasBreaking = commits.some((c) => c.breakingChange);
    const hasFeat = commits.some((c) => c.type === 'feat');

    if (hasBreaking) return 'major';
    if (hasFeat) return 'minor';
    return 'patch';
  }
}
