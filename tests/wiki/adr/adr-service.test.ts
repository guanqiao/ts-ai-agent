import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ADRService,
  ADRExtractor,
  ADRTemplates,
} from '../../../src/wiki/adr';

describe('ADRService', () => {
  let service: ADRService;
  const testPath = path.join(__dirname, 'test-adr');

  beforeAll(async () => {
    await fs.mkdir(testPath, { recursive: true });
    service = new ADRService(testPath);
    await service.initialize();
  });

  afterAll(async () => {
    await fs.rm(testPath, { recursive: true, force: true });
  });

  describe('propose', () => {
    it('should create a proposed ADR', async () => {
      const adr = await service.propose(
        'Use TypeScript for new projects',
        'We need to decide on a primary language for new projects',
        'We will use TypeScript for all new projects',
        'user-1'
      );

      expect(adr).toBeDefined();
      expect(adr.title).toBe('Use TypeScript for new projects');
      expect(adr.status).toBe('proposed');
      expect(adr.createdBy).toBe('user-1');
      expect(adr.id).toBeDefined();
    });
  });

  describe('accept', () => {
    it('should accept a proposed ADR', async () => {
      const proposed = await service.propose(
        'Accept Test',
        'Context',
        'Decision',
        'user-1'
      );

      const accepted = await service.accept(proposed.id, 'user-2');

      expect(accepted.status).toBe('accepted');
      expect(accepted.decisionMakers).toContain('user-2');
    });

    it('should throw error when accepting non-proposed ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user-1');
      await service.accept(adr.id, 'user-2');

      await expect(service.accept(adr.id, 'user-3')).rejects.toThrow();
    });
  });

  describe('deprecate', () => {
    it('should deprecate an accepted ADR', async () => {
      const adr = await service.propose('Deprecate Test', 'Context', 'Decision', 'user-1');
      await service.accept(adr.id, 'user-2');

      const deprecated = await service.deprecate(adr.id, 'No longer needed', 'user-3');

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.customFields?.deprecationReason).toBe('No longer needed');
    });
  });

  describe('reject', () => {
    it('should reject a proposed ADR', async () => {
      const adr = await service.propose('Reject Test', 'Context', 'Decision', 'user-1');

      const rejected = await service.reject(adr.id, 'Not a good idea', 'user-2');

      expect(rejected.status).toBe('rejected');
      expect(rejected.customFields?.rejectionReason).toBe('Not a good idea');
    });
  });

  describe('get', () => {
    it('should return ADR by id', async () => {
      const created = await service.propose('Get Test', 'Context', 'Decision', 'user-1');

      const found = await service.get(created.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Get Test');
    });

    it('should return null for non-existent ADR', async () => {
      const found = await service.get('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all ADRs', async () => {
      await service.propose('List Test 1', 'Context', 'Decision', 'user-1');
      await service.propose('List Test 2', 'Context', 'Decision', 'user-1');

      const list = await service.list();
      expect(list.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const adr1 = await service.propose('Filter Test 1', 'Context', 'Decision', 'user-1');
      const adr2 = await service.propose('Filter Test 2', 'Context', 'Decision', 'user-1');
      await service.accept(adr2.id, 'user-2');

      const proposed = await service.list({ status: ['proposed'] });
      const accepted = await service.list({ status: ['accepted'] });

      expect(proposed.some((a) => a.id === adr1.id)).toBe(true);
      expect(accepted.some((a) => a.id === adr2.id)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an ADR', async () => {
      const adr = await service.propose('Update Test', 'Context', 'Decision', 'user-1');

      const updated = await service.update(adr.id, {
        context: 'Updated context',
      });

      expect(updated.context).toBe('Updated context');
    });
  });

  describe('delete', () => {
    it('should delete an ADR', async () => {
      const adr = await service.propose('Delete Test', 'Context', 'Decision', 'user-1');

      const deleted = await service.delete(adr.id);
      expect(deleted).toBe(true);

      const found = await service.get(adr.id);
      expect(found).toBeNull();
    });
  });

  describe('linkToPage', () => {
    it('should link ADR to a page', async () => {
      const adr = await service.propose('Link Test', 'Context', 'Decision', 'user-1');

      await service.linkToPage(adr.id, 'page-1');

      const adrs = await service.getADRsForPage('page-1');
      expect(adrs.some((a) => a.id === adr.id)).toBe(true);
    });
  });

  describe('linkToCode', () => {
    it('should link ADR to code', async () => {
      const adr = await service.propose('Code Link Test', 'Context', 'Decision', 'user-1');

      await service.linkToCode(adr.id, {
        filePath: 'src/test.ts',
        lineStart: 10,
        lineEnd: 20,
      });

      const adrs = await service.getADRsForCode('src/test.ts');
      expect(adrs.some((a) => a.id === adr.id)).toBe(true);
    });
  });

  describe('supersede', () => {
    it('should supersede an old ADR with a new one', async () => {
      const oldAdr = await service.propose('Old ADR', 'Context', 'Decision', 'user-1');
      await service.accept(oldAdr.id, 'user-2');

      const newAdr = await service.propose('New ADR', 'Context', 'New Decision', 'user-1');
      await service.accept(newAdr.id, 'user-2');

      await service.supersede(oldAdr.id, newAdr.id);

      const oldUpdated = await service.get(oldAdr.id);
      expect(oldUpdated?.status).toBe('superseded');
      expect(oldUpdated?.links.some((l) => l.type === 'superseded-by' && l.adrId === newAdr.id)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return ADR statistics', async () => {
      const stats = await service.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('byTag');
    });
  });
});

describe('ADRExtractor', () => {
  let extractor: ADRExtractor;

  beforeAll(() => {
    extractor = new ADRExtractor();
  });

  describe('extractFromCode', () => {
    it('should extract decisions from code comments', async () => {
      const code = `
/**
 * @decision Use dependency injection for services
 * @why This makes testing easier and decouples components
 */
class ServiceContainer {
  // @decision Use Map for service registry for O(1) lookup
  private services = new Map();
}
`;

      const results = await extractor.extractFromCode('test.ts', code);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].adr.title).toBeDefined();
      expect(results[0].source).toBe('code');
    });

    it('should extract decisions from line comments', async () => {
      const code = `
// DECISION: Use async/await instead of Promises
// We decided to use async/await for better readability
async function fetchData() {}
`;

      const results = await extractor.extractFromCode('test.ts', code);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('extractFromCommits', () => {
    it('should extract decisions from conventional commits', async () => {
      const commits = [
        'feat(auth): implement JWT authentication',
        'refactor(api): switch to GraphQL for better flexibility',
        'fix: resolve race condition in event handler',
      ];

      const results = await extractor.extractFromCommits(commits);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.source === 'commit')).toBe(true);
    });

    it('should extract decisions from commit messages with decision keywords', async () => {
      const commits = [
        'We decided to use PostgreSQL for the database',
        'chose to implement caching with Redis',
      ];

      const results = await extractor.extractFromCommits(commits);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('extractFromDocs', () => {
    it('should extract decisions from markdown documents', async () => {
      const doc = `
# Architecture Decision: Use Microservices

## Context

We need to scale our application independently.

## Decision

We decided to adopt microservices architecture.

## Consequences

- Positive: Independent scaling
- Negative: Increased complexity
`;

      const results = await extractor.extractFromDocs('architecture.md', doc);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('document');
    });
  });
});

describe('ADRTemplates', () => {
  let templates: ADRTemplates;
  const testPath = path.join(__dirname, 'test-templates');

  beforeAll(async () => {
    await fs.mkdir(testPath, { recursive: true });
    templates = new ADRTemplates(testPath);
    await templates.initialize();
  });

  afterAll(async () => {
    await fs.rm(testPath, { recursive: true, force: true });
  });

  describe('getTemplates', () => {
    it('should return default templates', async () => {
      const allTemplates = await templates.getTemplates();

      expect(allTemplates.length).toBeGreaterThan(0);
      expect(allTemplates.some((t) => t.isDefault)).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should return default template', async () => {
      const defaultTemplate = await templates.getTemplate('default');

      expect(defaultTemplate).toBeDefined();
      expect(defaultTemplate?.name).toBe('Standard ADR');
    });
  });

  describe('fillTemplate', () => {
    it('should fill template with variables', async () => {
      const filled = await templates.fillTemplate('default', {
        title: 'Test Decision',
        status: 'proposed',
        date: '2024-01-01',
        decisionMakers: 'John Doe',
        context: 'Test context',
        decision: 'Test decision',
      });

      expect(filled).toContain('# Test Decision');
      expect(filled).toContain('proposed');
      expect(filled).toContain('Test context');
    });
  });

  describe('validateTemplate', () => {
    it('should validate required variables', async () => {
      const validation = await templates.validateTemplate('default', {
        title: 'Test',
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation with all required variables', async () => {
      const validation = await templates.validateTemplate('default', {
        title: 'Test Decision',
        status: 'proposed',
        date: '2024-01-01',
        decisionMakers: 'John Doe',
        context: 'Test context',
        decision: 'Test decision',
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('addTemplate', () => {
    it('should add a custom template', async () => {
      const custom = await templates.addTemplate({
        name: 'Custom Template',
        description: 'A custom template for testing',
        content: '# {{title}}\n\n{{content}}',
        variables: [
          { name: 'title', description: 'Title', type: 'text', required: true },
          { name: 'content', description: 'Content', type: 'markdown', required: true },
        ],
        isDefault: false,
      });

      expect(custom.id).toBeDefined();
      expect(custom.name).toBe('Custom Template');

      const found = await templates.getTemplate(custom.id);
      expect(found).toBeDefined();
    });
  });

  describe('removeTemplate', () => {
    it('should remove a custom template', async () => {
      const custom = await templates.addTemplate({
        name: 'To Remove',
        description: 'Template to remove',
        content: '# {{title}}',
        variables: [{ name: 'title', description: 'Title', type: 'text', required: true }],
        isDefault: false,
      });

      const removed = await templates.removeTemplate(custom.id);
      expect(removed).toBe(true);

      const found = await templates.getTemplate(custom.id);
      expect(found).toBeNull();
    });

    it('should not remove default templates', async () => {
      await expect(templates.removeTemplate('default')).rejects.toThrow('Cannot remove default templates');
    });
  });
});
