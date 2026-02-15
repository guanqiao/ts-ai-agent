import { GitService } from '../../src/git/git-service';
import * as fs from 'fs';
import * as path from 'path';

describe('GitService', () => {
  let gitService: GitService;
  const testRepoPath = path.join(__dirname, 'test-repo');

  beforeAll(() => {
    gitService = new GitService();
  });

  afterAll(() => {
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('isGitRepo', () => {
    it('should return true for a git repository', async () => {
      const result = await gitService.isGitRepo(process.cwd());
      expect(result).toBe(true);
    });

    it('should return false for a non-git directory', async () => {
      const tempDir = path.join(__dirname, 'temp-non-git');
      fs.mkdirSync(tempDir, { recursive: true });
      
      const result = await gitService.isGitRepo(tempDir);
      expect(result).toBe(false);
      
      fs.rmdirSync(tempDir);
    });
  });

  describe('getRepoRoot', () => {
    it('should return the repository root path', async () => {
      const root = await gitService.getRepoRoot(process.cwd());
      expect(root).toBeDefined();
      expect(fs.existsSync(root)).toBe(true);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await gitService.getCurrentBranch(process.cwd());
      expect(branch).toBeDefined();
      expect(typeof branch).toBe('string');
    });
  });

  describe('getHeadCommit', () => {
    it('should return the head commit information', async () => {
      const commit = await gitService.getHeadCommit(process.cwd());
      
      expect(commit).toBeDefined();
      expect(commit.hash).toBeDefined();
      expect(commit.shortHash).toBeDefined();
      expect(commit.message).toBeDefined();
      expect(commit.author).toBeDefined();
      expect(commit.date).toBeInstanceOf(Date);
    });
  });

  describe('getCommits', () => {
    it('should return a list of commits', async () => {
      const commits = await gitService.getCommits(process.cwd(), { maxCount: 5 });
      
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getChangedFiles', () => {
    it('should return an array of changed files', async () => {
      const files = await gitService.getChangedFiles(process.cwd(), 'HEAD~1');
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return the repository status', async () => {
      const status = await gitService.getStatus(process.cwd());
      
      expect(status).toBeDefined();
      expect(status.branch).toBeDefined();
      expect(typeof status.ahead).toBe('number');
      expect(typeof status.behind).toBe('number');
      expect(Array.isArray(status.staged)).toBe(true);
      expect(Array.isArray(status.modified)).toBe(true);
      expect(Array.isArray(status.untracked)).toBe(true);
    });
  });
});
