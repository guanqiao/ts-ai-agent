import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import {
  IGitService,
  GitCommit,
  GitDiff,
  GitStatus,
  BlameInfo,
  GitLogOptions,
  GitDiffOptions,
  ChangeType,
  DiffHunk,
} from './types';

const execAsync = promisify(exec);

export class GitService implements IGitService {
  async isGitRepo(repoPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(repoPath, '.git');
      const stat = await fs.promises.stat(gitDir);
      return stat.isDirectory() || stat.isFile();
    } catch {
      return false;
    }
  }

  async getRepoRoot(startPath: string): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', {
      cwd: startPath,
    });
    return stdout.trim();
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
    });
    return stdout.trim();
  }

  async getHeadCommit(repoPath: string): Promise<GitCommit> {
    const format = '%H%n%h%n%s%n%an%n%ae%n%aI%n%P';
    const { stdout } = await execAsync(`git log -1 --format="${format}"`, {
      cwd: repoPath,
    });

    const lines = stdout.trim().split('\n');
    return {
      hash: lines[0],
      shortHash: lines[1],
      message: lines[2],
      author: lines[3],
      authorEmail: lines[4],
      date: new Date(lines[5]),
      parentHashes: lines[6] ? lines[6].split(' ') : [],
    };
  }

  async getCommits(repoPath: string, options?: GitLogOptions): Promise<GitCommit[]> {
    const args = ['git', 'log'];

    if (options?.maxCount) {
      args.push(`-${options.maxCount}`);
    }

    if (options?.since) {
      args.push(`--since="${options.since.toISOString()}"`);
    }

    if (options?.until) {
      args.push(`--until="${options.until.toISOString()}"`);
    }

    if (options?.author) {
      args.push(`--author="${options.author}"`);
    }

    if (options?.filePath) {
      args.push('--', options.filePath);
    }

    const format = '%H%n%h%n%s%n%an%n%ae%n%aI%n%P%n---COMMIT---';
    args.push(`--format="${format}"`);

    const { stdout } = await execAsync(args.join(' '), { cwd: repoPath });

    const commits: GitCommit[] = [];
    const commitBlocks = stdout.split('---COMMIT---').filter((b) => b.trim());

    for (const block of commitBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 6) {
        commits.push({
          hash: lines[0],
          shortHash: lines[1],
          message: lines[2],
          author: lines[3],
          authorEmail: lines[4],
          date: new Date(lines[5]),
          parentHashes: lines[6] ? lines[6].split(' ') : [],
        });
      }
    }

    return commits;
  }

  async getChangedFiles(repoPath: string, since?: string): Promise<string[]> {
    let command = 'git diff --name-only';
    if (since) {
      command += ` ${since}..HEAD`;
    } else {
      command += ' HEAD~1..HEAD';
    }

    const { stdout } = await execAsync(command, { cwd: repoPath });
    return stdout.trim().split('\n').filter((f) => f.length > 0);
  }

  async getDiff(repoPath: string, options?: GitDiffOptions): Promise<GitDiff[]> {
    const args = ['git', 'diff'];

    if (options?.staged) {
      args.push('--staged');
    }

    if (options?.since && options?.until) {
      args.push(`${options.since}..${options.until}`);
    } else if (options?.since) {
      args.push(`${options.since}..HEAD`);
    }

    if (options?.filePath) {
      args.push('--', options.filePath);
    }

    args.push('--unified=3');

    const { stdout } = await execAsync(args.join(' '), { cwd: repoPath });

    return this.parseDiffOutput(stdout);
  }

  async getFileDiff(
    repoPath: string,
    filePath: string,
    since?: string
  ): Promise<GitDiff> {
    const diffs = await this.getDiff(repoPath, {
      filePath,
      since,
    });

    if (diffs.length === 0) {
      return {
        filePath,
        changeType: 'modified',
        additions: 0,
        deletions: 0,
        hunks: [],
      };
    }

    return diffs[0];
  }

  async getBlame(repoPath: string, filePath: string): Promise<BlameInfo[]> {
    const { stdout } = await execAsync(
      `git blame --line-porcelain "${filePath}"`,
      { cwd: repoPath }
    );

    return this.parseBlameOutput(stdout);
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const { stdout } = await execAsync('git status --porcelain=v2 --branch', {
      cwd: repoPath,
    });

    return this.parseStatusOutput(stdout);
  }

  private parseDiffOutput(output: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const diffBlocks = output.split(/^diff --git /m).filter((b) => b.trim());

    for (const block of diffBlocks) {
      const lines = block.split('\n');
      const headerLine = lines[0];

      const pathMatch = headerLine.match(/^a\/(.+) b\/(.+)$/);
      if (!pathMatch) continue;

      const oldPath = pathMatch[1];
      const newPath = pathMatch[2];

      let changeType: ChangeType = 'modified';
      if (oldPath === '/dev/null') {
        changeType = 'added';
      } else if (newPath === '/dev/null') {
        changeType = 'deleted';
      } else if (oldPath !== newPath) {
        changeType = 'renamed';
      }

      const hunks: DiffHunk[] = [];
      let additions = 0;
      let deletions = 0;

      const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }

        const hunkMatch = line.match(hunkPattern);
        if (hunkMatch) {
          const hunkLines: string[] = [line];
          let j = i + 1;
          while (j < lines.length && !lines[j].match(hunkPattern)) {
            hunkLines.push(lines[j]);
            j++;
          }

          hunks.push({
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: parseInt(hunkMatch[2] || '1', 10),
            newStart: parseInt(hunkMatch[3], 10),
            newLines: parseInt(hunkMatch[4] || '1', 10),
            content: hunkLines.join('\n'),
          });
        }
      }

      diffs.push({
        filePath: changeType === 'deleted' ? oldPath : newPath,
        oldPath: changeType === 'renamed' ? oldPath : undefined,
        newPath: changeType === 'renamed' ? newPath : undefined,
        changeType,
        additions,
        deletions,
        hunks,
      });
    }

    return diffs;
  }

  private parseBlameOutput(output: string): BlameInfo[] {
    const blames: BlameInfo[] = [];
    const lines = output.split('\n');

    let currentCommit: Partial<GitCommit> = {};
    let currentLine = 0;
    let currentContent = '';

    for (const line of lines) {
      if (line.startsWith('author ')) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        currentCommit.authorEmail = line.substring(12).replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ')) {
        currentCommit.date = new Date(parseInt(line.substring(12), 10) * 1000);
      } else if (line.startsWith('summary ')) {
        currentCommit.message = line.substring(8);
      } else if (line.match(/^\S{40}/)) {
        const parts = line.split(' ');
        currentCommit.hash = parts[0];
        currentLine = parseInt(parts[2], 10);
      } else if (line.startsWith('\t')) {
        currentContent = line.substring(1);

        if (currentCommit.hash) {
          blames.push({
            line: currentLine,
            content: currentContent,
            commit: {
              hash: currentCommit.hash,
              shortHash: currentCommit.hash.substring(0, 7),
              message: currentCommit.message || '',
              author: currentCommit.author || '',
              authorEmail: currentCommit.authorEmail || '',
              date: currentCommit.date || new Date(),
              parentHashes: [],
            },
          });
        }

        currentCommit = {};
        currentContent = '';
      }
    }

    return blames;
  }

  private parseStatusOutput(output: string): GitStatus {
    const status: GitStatus = {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
    };

    const lines = output.split('\n');

    for (const line of lines) {
      if (line.startsWith('# branch.head ')) {
        status.branch = line.substring(13).trim();
      } else if (line.startsWith('# branch.ab +')) {
        status.ahead = parseInt(line.substring(13).trim(), 10);
      } else if (line.startsWith('# branch.ab -')) {
        status.behind = parseInt(line.substring(13).trim(), 10);
      } else if (line.match(/^[12] [MADRC]/)) {
        const parts = line.split(' ');
        const xy = parts[1];
        const filePath = parts[parts.length - 1];

        if (xy.includes('M') || xy.includes('A') || xy.includes('D') || xy.includes('R')) {
          status.staged.push(filePath);
        }
        if (xy.includes('U')) {
          status.conflicted.push(filePath);
        }
      } else if (line.startsWith('? ')) {
        status.untracked.push(line.substring(2));
      }
    }

    return status;
  }
}
