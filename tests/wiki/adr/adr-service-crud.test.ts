import * as path from 'path';
import * as fs from 'fs';
import { ADRService } from '../../../src/wiki/adr/adr-service';

describe('ADRService CRUD', () => {
  let service: ADRService;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-adr-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    service = new ADRService(testProjectPath);
    await service.initialize();
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('create', () => {
    it('should create a new ADR', async () => {
      const adr = await service.create({
        title: 'Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Test context',
        decision: 'Test decision',
        consequences: {
          positive: ['benefit1'],
          negative: ['drawback1'],
          neutral: [],
        },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['test'],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      expect(adr).toBeDefined();
      expect(adr.id).toBeDefined();
      expect(adr.title).toBe('Test ADR');
      expect(adr.status).toBe('proposed');
      expect(adr.createdAt).toBeInstanceOf(Date);
      expect(adr.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', async () => {
      const adr1 = await service.create({
        title: 'ADR 1',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context 1',
        decision: 'Decision 1',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const adr2 = await service.create({
        title: 'ADR 2',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context 2',
        decision: 'Decision 2',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      expect(adr1.id).not.toBe(adr2.id);
    });

    it('should save ADR to file', async () => {
      const adr = await service.create({
        title: 'File Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${adr.id}.json`);
      expect(fs.existsSync(adrPath)).toBe(true);

      const content = fs.readFileSync(adrPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.title).toBe('File Test ADR');
    });
  });

  describe('get', () => {
    it('should get an ADR by id', async () => {
      const created = await service.create({
        title: 'Get Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const retrieved = await service.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Get Test ADR');
    });

    it('should return null for non-existent ADR', async () => {
      const result = await service.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an ADR', async () => {
      const created = await service.create({
        title: 'Original Title',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const updated = await service.update(created.id, {
        title: 'Updated Title',
        context: 'Updated context',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.context).toBe('Updated context');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should throw error for non-existent ADR', async () => {
      await expect(
        service.update('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow('not found');
    });

    it('should not update restricted fields', async () => {
      const created = await service.create({
        title: 'Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const originalId = created.id;
      const originalCreatedAt = created.createdAt;

      const updated = await service.update(created.id, {
        id: 'new-id',
        createdAt: new Date('2020-01-01'),
        createdBy: 'new-user',
        title: 'Updated Title',
      });

      expect(updated.id).toBe(originalId);
      expect(updated.createdAt).toEqual(originalCreatedAt);
      expect(updated.createdBy).toBe('user1');
      expect(updated.title).toBe('Updated Title');
    });

    it('should update the file', async () => {
      const created = await service.create({
        title: 'File Update Test',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.update(created.id, { title: 'Updated Title' });

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${created.id}.json`);
      const content = fs.readFileSync(adrPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.title).toBe('Updated Title');
    });
  });

  describe('delete', () => {
    it('should delete an ADR', async () => {
      const created = await service.create({
        title: 'Delete Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const result = await service.delete(created.id);

      expect(result).toBe(true);

      const retrieved = await service.get(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ADR', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });

    it('should delete the file', async () => {
      const created = await service.create({
        title: 'File Delete Test',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${created.id}.json`);
      expect(fs.existsSync(adrPath)).toBe(true);

      await service.delete(created.id);

      expect(fs.existsSync(adrPath)).toBe(false);
    });

    it('should remove links when deleting', async () => {
      const created = await service.create({
        title: 'Links Delete Test',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.linkToPage(created.id, 'page-1');
      await service.linkToCode(created.id, {
        filePath: 'src/test.ts',
        lineStart: 1,
        lineEnd: 10,
      });

      await service.delete(created.id);

      // Links should be removed
      const relatedADRs = await service.getADRsForPage('page-1');
      expect(relatedADRs.length).toBe(0);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await service.create({
        title: 'ADR 1',
        status: 'proposed',
        date: new Date('2024-01-15'),
        decisionMakers: ['user1'],
        context: 'Context 1',
        decision: 'Decision 1',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['architecture', 'database'],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.create({
        title: 'ADR 2',
        status: 'accepted',
        date: new Date('2024-01-10'),
        decisionMakers: ['user2'],
        context: 'Context 2',
        decision: 'Decision 2',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['api'],
        customFields: {},
        createdBy: 'user2',
        updatedBy: 'user2',
      });

      await service.create({
        title: 'ADR 3',
        status: 'deprecated',
        date: new Date('2024-01-20'),
        decisionMakers: ['user1'],
        context: 'Context 3',
        decision: 'Decision 3',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['architecture'],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });
    });

    it('should return all ADRs sorted by date', async () => {
      const adrs = await service.list();

      expect(adrs.length).toBe(3);
      expect(adrs[0].date.getTime()).toBeGreaterThanOrEqual(adrs[1].date.getTime());
    });

    it('should filter by status', async () => {
      const adrs = await service.list({ status: ['proposed'] });

      expect(adrs.length).toBe(1);
      expect(adrs[0].status).toBe('proposed');
    });

    it('should filter by multiple statuses', async () => {
      const adrs = await service.list({ status: ['proposed', 'accepted'] });

      expect(adrs.length).toBe(2);
    });

    it('should filter by tags', async () => {
      const adrs = await service.list({ tags: ['architecture'] });

      expect(adrs.length).toBe(2);
    });

    it('should filter by createdBy', async () => {
      const adrs = await service.list({ createdBy: 'user1' });

      expect(adrs.length).toBe(2);
    });

    it('should filter by date range', async () => {
      const adrs = await service.list({
        dateFrom: new Date('2024-01-12'),
        dateTo: new Date('2024-01-18'),
      });

      expect(adrs.length).toBe(1);
      expect(adrs[0].title).toBe('ADR 1');
    });

    it('should search by query', async () => {
      const adrs = await service.list({ searchQuery: 'context 1' });

      expect(adrs.length).toBe(1);
      expect(adrs[0].title).toBe('ADR 1');
    });

    it('should combine filters', async () => {
      const adrs = await service.list({
        status: ['proposed', 'accepted'],
        createdBy: 'user1',
      });

      expect(adrs.length).toBe(1);
      expect(adrs[0].title).toBe('ADR 1');
    });
  });

  describe('propose', () => {
    it('should create a proposed ADR', async () => {
      const adr = await service.propose(
        'New Feature',
        'We need to add a new feature',
        'We will use approach A',
        'user1'
      );

      expect(adr.status).toBe('proposed');
      expect(adr.title).toBe('New Feature');
      expect(adr.context).toBe('We need to add a new feature');
      expect(adr.decision).toBe('We will use approach A');
      expect(adr.createdBy).toBe('user1');
      expect(adr.decisionMakers).toContain('user1');
    });
  });

  describe('linkToPage', () => {
    it('should link ADR to page', async () => {
      const adr = await service.create({
        title: 'Link Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.linkToPage(adr.id, 'page-1');

      const related = await service.getADRsForPage('page-1');
      expect(related.length).toBe(1);
      expect(related[0].id).toBe(adr.id);
    });

    it('should throw error for non-existent ADR', async () => {
      await expect(service.linkToPage('non-existent', 'page-1')).rejects.toThrow('not found');
    });
  });

  describe('linkToCode', () => {
    it('should link ADR to code', async () => {
      const adr = await service.create({
        title: 'Code Link Test ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.linkToCode(adr.id, {
        filePath: 'src/test.ts',
        lineStart: 10,
        lineEnd: 20,
        symbol: 'TestClass',
      });

      const updated = await service.get(adr.id);
      expect(updated?.codeReferences.length).toBe(1);
      expect(updated?.codeReferences[0].filePath).toBe('src/test.ts');
    });
  });

  describe('getRelated', () => {
    it('should get related ADRs', async () => {
      const adr1 = await service.create({
        title: 'ADR 1',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const adr2 = await service.create({
        title: 'ADR 2',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [{ type: 'relates-to', adrId: adr1.id }],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const related = await service.getRelated(adr1.id);
      expect(related.length).toBe(1);
      expect(related[0].id).toBe(adr2.id);
    });
  });

  describe('getByStatus', () => {
    it('should get ADRs by status', async () => {
      await service.create({
        title: 'Proposed ADR',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.create({
        title: 'Accepted ADR',
        status: 'accepted',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const proposed = await service.getByStatus('proposed');
      expect(proposed.length).toBe(1);
      expect(proposed[0].title).toBe('Proposed ADR');
    });
  });

  describe('getRecent', () => {
    it('should get recent ADRs', async () => {
      for (let i = 1; i <= 5; i++) {
        await service.create({
          title: `ADR ${i}`,
          status: 'proposed',
          date: new Date(Date.now() - i * 86400000),
          decisionMakers: ['user1'],
          context: 'Context',
          decision: 'Decision',
          consequences: { positive: [], negative: [], neutral: [] },
          alternatives: [],
          links: [],
          codeReferences: [],
          tags: [],
          customFields: {},
          createdBy: 'user1',
          updatedBy: 'user1',
        });
      }

      const recent = await service.getRecent(3);
      expect(recent.length).toBe(3);
    });
  });

  describe('search', () => {
    it('should search ADRs', async () => {
      await service.create({
        title: 'Database Choice',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'We need to choose a database',
        decision: 'Use PostgreSQL',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.create({
        title: 'API Design',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Designing the API',
        decision: 'Use REST',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: [],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const results = await service.search('database');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Database Choice');
    });
  });

  describe('getStats', () => {
    it('should return ADR statistics', async () => {
      await service.create({
        title: 'ADR 1',
        status: 'proposed',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['architecture'],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      await service.create({
        title: 'ADR 2',
        status: 'accepted',
        date: new Date(),
        decisionMakers: ['user1'],
        context: 'Context',
        decision: 'Decision',
        consequences: { positive: [], negative: [], neutral: [] },
        alternatives: [],
        links: [],
        codeReferences: [],
        tags: ['architecture', 'api'],
        customFields: {},
        createdBy: 'user1',
        updatedBy: 'user1',
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.proposed).toBe(1);
      expect(stats.byStatus.accepted).toBe(1);
      expect(stats.byTag.architecture).toBe(2);
      expect(stats.byTag.api).toBe(1);
    });
  });
});
