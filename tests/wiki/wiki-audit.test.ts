import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WikiAudit } from '../../src/wiki/wiki-audit';

describe('WikiAudit', () => {
  let tempDir: string;
  let wikiAudit: WikiAudit;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-audit-test-'));
    wikiAudit = new WikiAudit(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const log = await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Test Page',
        version: 1,
        performedBy: 'user1',
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe('page-created');
      expect(log.pageId).toBe('page1');
      expect(log.pageTitle).toBe('Test Page');
      expect(log.version).toBe(1);
      expect(log.performedBy).toBe('user1');
      expect(log.performedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for each log', async () => {
      const log1 = await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
      });

      const log2 = await wikiAudit.log('page-created', {
        pageId: 'page2',
        pageTitle: 'Page 2',
        version: 1,
      });

      expect(log1.id).not.toBe(log2.id);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test logs
      await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
        performedBy: 'user1',
      });

      await wikiAudit.log('page-updated', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        oldVersion: 1,
        newVersion: 2,
        performedBy: 'user2',
      });

      await wikiAudit.log('page-created', {
        pageId: 'page2',
        pageTitle: 'Page 2',
        version: 1,
        performedBy: 'user1',
      });
    });

    it('should query logs by pageId', async () => {
      const logs = await wikiAudit.query({ pageId: 'page1' });

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.pageId === 'page1')).toBe(true);
    });

    it('should query logs by action', async () => {
      const logs = await wikiAudit.query({ action: 'page-created' });

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.action === 'page-created')).toBe(true);
    });

    it('should query logs by performedBy', async () => {
      const logs = await wikiAudit.query({ performedBy: 'user1' });

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.performedBy === 'user1')).toBe(true);
    });

    it('should support pagination with limit and offset', async () => {
      const logs = await wikiAudit.query({ limit: 1, offset: 0 });

      expect(logs).toHaveLength(1);
    });

    it('should return logs sorted by performedAt descending', async () => {
      const logs = await wikiAudit.query({});

      for (let i = 0; i < logs.length - 1; i++) {
        const current = new Date(logs[i].performedAt).getTime();
        const next = new Date(logs[i + 1].performedAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('getRecentLogs', () => {
    it('should return recent logs with default limit', async () => {
      for (let i = 0; i < 10; i++) {
        await wikiAudit.log('page-created', {
          pageId: `page${i}`,
          pageTitle: `Page ${i}`,
          version: 1,
        });
      }

      const logs = await wikiAudit.getRecentLogs();

      expect(logs.length).toBeLessThanOrEqual(50);
    });

    it('should return recent logs with custom limit', async () => {
      for (let i = 0; i < 10; i++) {
        await wikiAudit.log('page-created', {
          pageId: `page${i}`,
          pageTitle: `Page ${i}`,
          version: 1,
        });
      }

      const logs = await wikiAudit.getRecentLogs(5);

      expect(logs).toHaveLength(5);
    });
  });

  describe('getPageLogs', () => {
    it('should return logs for a specific page', async () => {
      await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
      });

      await wikiAudit.log('page-updated', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        oldVersion: 1,
        newVersion: 2,
      });

      await wikiAudit.log('page-created', {
        pageId: 'page2',
        pageTitle: 'Page 2',
        version: 1,
      });

      const logs = await wikiAudit.getPageLogs('page1');

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.pageId === 'page1')).toBe(true);
    });
  });

  describe('exportLogs', () => {
    it('should export logs within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
      });

      const logs = await wikiAudit.exportLogs(yesterday, tomorrow);

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return empty array for future date range', async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const furtherFuture = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const logs = await wikiAudit.exportLogs(future, furtherFuture);

      expect(logs).toHaveLength(0);
    });
  });

  describe('loadAllLogs', () => {
    it('should load all logs from all audit files', async () => {
      await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
      });

      const allLogs = await wikiAudit.loadAllLogs();

      expect(allLogs.length).toBeGreaterThan(0);
    });

    it('should return logs sorted by performedAt descending', async () => {
      await wikiAudit.log('page-created', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        version: 1,
      });

      await wikiAudit.log('page-updated', {
        pageId: 'page1',
        pageTitle: 'Page 1',
        oldVersion: 1,
        newVersion: 2,
      });

      const allLogs = await wikiAudit.loadAllLogs();

      for (let i = 0; i < allLogs.length - 1; i++) {
        const current = new Date(allLogs[i].performedAt).getTime();
        const next = new Date(allLogs[i + 1].performedAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });
});
