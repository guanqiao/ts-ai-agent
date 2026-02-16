import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WikiHistory } from '../../src/wiki/wiki-history';
import { WikiPage, WikiCategory } from '../../src/wiki/types';
import { DocumentFormat, Language } from '../../src/types';

describe('WikiHistory', () => {
  let tempDir: string;
  let wikiHistory: WikiHistory;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-history-test-'));
    wikiHistory = new WikiHistory(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createMockPage = (
    id: string,
    version: number,
    content: string = 'Test content'
  ): WikiPage => ({
    id,
    title: `Test Page ${id}`,
    slug: `test-page-${id}`,
    content,
    format: DocumentFormat.Markdown,
    metadata: {
      tags: ['test'],
      category: 'overview' as WikiCategory,
      sourceFiles: [],
      language: Language.TypeScript,
    },
    sections: [],
    links: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version,
  });

  describe('saveVersion', () => {
    it('should save a new version of a page', async () => {
      const page = createMockPage('page1', 1);
      const version = await wikiHistory.saveVersion(page, 'Initial version', 'user1');

      expect(version.version).toBe(1);
      expect(version.pageId).toBe('page1');
      expect(version.changeSummary).toBe('Initial version');
      expect(version.changedBy).toBe('user1');
    });

    it('should save multiple versions', async () => {
      const page1 = createMockPage('page1', 1, 'Content v1');
      await wikiHistory.saveVersion(page1, 'Initial', 'user1');

      const page2 = createMockPage('page1', 2, 'Content v2');
      await wikiHistory.saveVersion(page2, 'Updated', 'user2');

      const history = await wikiHistory.getHistory('page1');
      expect(history?.versions).toHaveLength(2);
      expect(history?.currentVersion).toBe(2);
    });
  });

  describe('getVersion', () => {
    it('should retrieve a specific version', async () => {
      const page = createMockPage('page1', 1, 'Original content');
      await wikiHistory.saveVersion(page, 'Initial', 'user1');

      const retrieved = await wikiHistory.getVersion('page1', 1);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('Original content');
      expect(retrieved?.version).toBe(1);
    });

    it('should return null for non-existent version', async () => {
      const retrieved = await wikiHistory.getVersion('page1', 999);
      expect(retrieved).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should retrieve complete history for a page', async () => {
      for (let i = 1; i <= 3; i++) {
        const page = createMockPage('page1', i, `Content v${i}`);
        await wikiHistory.saveVersion(page, `Version ${i}`, 'user1');
      }

      const history = await wikiHistory.getHistory('page1');
      expect(history).not.toBeNull();
      expect(history?.pageId).toBe('page1');
      expect(history?.versions).toHaveLength(3);
      expect(history?.currentVersion).toBe(3);
    });

    it('should return null for non-existent page', async () => {
      const history = await wikiHistory.getHistory('non-existent');
      expect(history).toBeNull();
    });
  });

  describe('listVersions', () => {
    it('should list versions with pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        const page = createMockPage('page1', i, `Content v${i}`);
        await wikiHistory.saveVersion(page, `Version ${i}`, 'user1');
      }

      const versions = await wikiHistory.listVersions('page1', 2, 0);
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(5); // Most recent first
      expect(versions[1].version).toBe(4);
    });

    it('should return empty array for non-existent page', async () => {
      const versions = await wikiHistory.listVersions('non-existent');
      expect(versions).toEqual([]);
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and return diff', async () => {
      const page1 = createMockPage('page1', 1, 'Line 1\nLine 2\nLine 3');
      await wikiHistory.saveVersion(page1, 'Initial', 'user1');

      const page2 = createMockPage('page1', 2, 'Line 1\nModified Line 2\nLine 3\nNew Line 4');
      await wikiHistory.saveVersion(page2, 'Updated', 'user2');

      const diff = await wikiHistory.compareVersions('page1', 1, 2);

      expect(diff.oldVersion).toBe(1);
      expect(diff.newVersion).toBe(2);
      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.changes.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent versions', async () => {
      await expect(wikiHistory.compareVersions('page1', 1, 2)).rejects.toThrow('Version not found');
    });
  });

  describe('rollback', () => {
    it('should rollback to a specific version', async () => {
      for (let i = 1; i <= 3; i++) {
        const page = createMockPage('page1', i, `Content v${i}`);
        await wikiHistory.saveVersion(page, `Version ${i}`, 'user1');
      }

      const rolledBack = await wikiHistory.rollback('page1', 1, 'admin');

      expect(rolledBack).not.toBeNull();
      expect(rolledBack?.content).toBe('Content v1');
      expect(rolledBack?.version).toBe(4); // New version after rollback
      expect(rolledBack?.metadata.custom?.rolledBackFrom).toBe(1);
    });

    it('should return null for non-existent version', async () => {
      const result = await wikiHistory.rollback('page1', 999, 'admin');
      expect(result).toBeNull();
    });
  });

  describe('deleteVersion', () => {
    it('should delete a specific version', async () => {
      const page = createMockPage('page1', 1);
      await wikiHistory.saveVersion(page, 'Initial', 'user1');

      const deleted = await wikiHistory.deleteVersion('page1', 1);
      expect(deleted).toBe(true);

      const retrieved = await wikiHistory.getVersion('page1', 1);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent version', async () => {
      const deleted = await wikiHistory.deleteVersion('page1', 999);
      expect(deleted).toBe(false);
    });
  });

  describe('cleanupOldVersions', () => {
    it('should cleanup old versions keeping specified count', async () => {
      for (let i = 1; i <= 5; i++) {
        const page = createMockPage('page1', i, `Content v${i}`);
        await wikiHistory.saveVersion(page, `Version ${i}`, 'user1');
      }

      const deletedCount = await wikiHistory.cleanupOldVersions('page1', 2);
      expect(deletedCount).toBe(3);

      const history = await wikiHistory.getHistory('page1');
      expect(history?.versions).toHaveLength(2);
    });

    it('should not delete if versions count is less than keep count', async () => {
      const page = createMockPage('page1', 1);
      await wikiHistory.saveVersion(page, 'Initial', 'user1');

      const deletedCount = await wikiHistory.cleanupOldVersions('page1', 5);
      expect(deletedCount).toBe(0);
    });
  });
});
