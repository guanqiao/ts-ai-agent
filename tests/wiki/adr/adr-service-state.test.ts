import * as path from 'path';
import * as fs from 'fs';
import { ADRService } from '../../../src/wiki/adr/adr-service';

describe('ADRService State Transitions', () => {
  let service: ADRService;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-adr-state-project');
    
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

  describe('accept', () => {
    it('should accept a proposed ADR', async () => {
      const adr = await service.propose(
        'Test ADR',
        'Test context',
        'Test decision',
        'user1'
      );

      const accepted = await service.accept(adr.id, 'user2');

      expect(accepted.status).toBe('accepted');
      expect(accepted.decisionMakers).toContain('user1');
      expect(accepted.decisionMakers).toContain('user2');
      expect(accepted.updatedBy).toBe('user2');
    });

    it('should throw error for non-existent ADR', async () => {
      await expect(service.accept('non-existent', 'user1')).rejects.toThrow('not found');
    });

    it('should throw error when accepting non-proposed ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user1');

      await expect(service.accept(adr.id, 'user2')).rejects.toThrow('Cannot accept');
    });

    it('should update the file', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user2');

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${adr.id}.json`);
      const content = fs.readFileSync(adrPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.status).toBe('accepted');
    });
  });

  describe('deprecate', () => {
    it('should deprecate an accepted ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user1');

      const deprecated = await service.deprecate(adr.id, 'No longer needed', 'user2');

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.customFields.deprecationReason).toBe('No longer needed');
      expect(deprecated.updatedBy).toBe('user2');
    });

    it('should throw error for non-existent ADR', async () => {
      await expect(service.deprecate('non-existent', 'Reason', 'user1')).rejects.toThrow('not found');
    });

    it('should throw error when deprecating non-accepted ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');

      await expect(service.deprecate(adr.id, 'Reason', 'user1')).rejects.toThrow('Cannot deprecate');
    });

    it('should update the file', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user1');
      await service.deprecate(adr.id, 'Reason', 'user2');

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${adr.id}.json`);
      const content = fs.readFileSync(adrPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.status).toBe('deprecated');
      expect(saved.customFields.deprecationReason).toBe('Reason');
    });
  });

  describe('reject', () => {
    it('should reject a proposed ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');

      const rejected = await service.reject(adr.id, 'Not viable', 'user2');

      expect(rejected.status).toBe('rejected');
      expect(rejected.customFields.rejectionReason).toBe('Not viable');
      expect(rejected.updatedBy).toBe('user2');
    });

    it('should throw error for non-existent ADR', async () => {
      await expect(service.reject('non-existent', 'Reason', 'user1')).rejects.toThrow('not found');
    });

    it('should throw error when rejecting non-proposed ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user1');

      await expect(service.reject(adr.id, 'Reason', 'user2')).rejects.toThrow('Cannot reject');
    });

    it('should update the file', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.reject(adr.id, 'Reason', 'user2');

      const adrPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${adr.id}.json`);
      const content = fs.readFileSync(adrPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.status).toBe('rejected');
      expect(saved.customFields.rejectionReason).toBe('Reason');
    });
  });

  describe('supersede', () => {
    it('should supersede an old ADR with a new one', async () => {
      const oldAdr = await service.propose('Old ADR', 'Old context', 'Old decision', 'user1');
      await service.accept(oldAdr.id, 'user1');

      const newAdr = await service.propose('New ADR', 'New context', 'New decision', 'user2');
      await service.accept(newAdr.id, 'user2');

      await service.supersede(oldAdr.id, newAdr.id);

      const updatedOld = await service.get(oldAdr.id);
      const updatedNew = await service.get(newAdr.id);

      expect(updatedOld?.status).toBe('superseded');
      expect(updatedOld?.links).toContainEqual({
        type: 'superseded-by',
        adrId: newAdr.id,
        adrTitle: 'New ADR',
      });

      expect(updatedNew?.links).toContainEqual({
        type: 'supersedes',
        adrId: oldAdr.id,
        adrTitle: 'Old ADR',
      });
    });

    it('should throw error when old ADR does not exist', async () => {
      const newAdr = await service.propose('New ADR', 'Context', 'Decision', 'user1');

      await expect(service.supersede('non-existent', newAdr.id)).rejects.toThrow('Both ADRs must exist');
    });

    it('should throw error when new ADR does not exist', async () => {
      const oldAdr = await service.propose('Old ADR', 'Context', 'Decision', 'user1');

      await expect(service.supersede(oldAdr.id, 'non-existent')).rejects.toThrow('Both ADRs must exist');
    });

    it('should update both files', async () => {
      const oldAdr = await service.propose('Old ADR', 'Context', 'Decision', 'user1');
      await service.accept(oldAdr.id, 'user1');

      const newAdr = await service.propose('New ADR', 'Context', 'Decision', 'user2');
      await service.accept(newAdr.id, 'user2');

      await service.supersede(oldAdr.id, newAdr.id);

      const oldPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${oldAdr.id}.json`);
      const newPath = path.join(testProjectPath, '.wiki', 'adr', `adr-${newAdr.id}.json`);

      const oldContent = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      const newContent = JSON.parse(fs.readFileSync(newPath, 'utf-8'));

      expect(oldContent.status).toBe('superseded');
      expect(newContent.links).toContainEqual({
        type: 'supersedes',
        adrId: oldAdr.id,
        adrTitle: 'Old ADR',
      });
    });
  });

  describe('State transition workflow', () => {
    it('should complete full workflow: propose -> accept -> deprecate', async () => {
      // Propose
      const adr = await service.propose('Feature X', 'Need feature X', 'Build feature X', 'user1');
      expect(adr.status).toBe('proposed');

      // Accept
      const accepted = await service.accept(adr.id, 'user2');
      expect(accepted.status).toBe('accepted');

      // Deprecate
      const deprecated = await service.deprecate(adr.id, 'Feature replaced by Y', 'user3');
      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.customFields.deprecationReason).toBe('Feature replaced by Y');
    });

    it('should complete full workflow: propose -> reject', async () => {
      const adr = await service.propose('Feature X', 'Need feature X', 'Build feature X', 'user1');
      expect(adr.status).toBe('proposed');

      const rejected = await service.reject(adr.id, 'Too expensive', 'user2');
      expect(rejected.status).toBe('rejected');
      expect(rejected.customFields.rejectionReason).toBe('Too expensive');
    });

    it('should complete full workflow: propose -> accept -> supersede', async () => {
      const oldAdr = await service.propose('Old Approach', 'Context', 'Decision', 'user1');
      await service.accept(oldAdr.id, 'user1');

      const newAdr = await service.propose('New Approach', 'Better context', 'Better decision', 'user2');
      await service.accept(newAdr.id, 'user2');

      await service.supersede(oldAdr.id, newAdr.id);

      const updatedOld = await service.get(oldAdr.id);
      expect(updatedOld?.status).toBe('superseded');
    });

    it('should track all decision makers', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user2');

      const updated = await service.get(adr.id);
      expect(updated?.decisionMakers).toContain('user1');
      expect(updated?.decisionMakers).toContain('user2');
      expect(updated?.decisionMakers.length).toBe(2);
    });
  });

  describe('Invalid state transitions', () => {
    it('should not allow accepting rejected ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.reject(adr.id, 'Reason', 'user2');

      await expect(service.accept(adr.id, 'user3')).rejects.toThrow('Cannot accept');
    });

    it('should not allow deprecating rejected ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.reject(adr.id, 'Reason', 'user2');

      await expect(service.deprecate(adr.id, 'Reason', 'user3')).rejects.toThrow('Cannot deprecate');
    });

    it('should not allow rejecting deprecated ADR', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      await service.accept(adr.id, 'user2');
      await service.deprecate(adr.id, 'Reason', 'user3');

      await expect(service.reject(adr.id, 'Reason', 'user4')).rejects.toThrow('Cannot reject');
    });

    it('should not allow rejecting superseded ADR', async () => {
      const oldAdr = await service.propose('Old', 'Context', 'Decision', 'user1');
      await service.accept(oldAdr.id, 'user1');

      const newAdr = await service.propose('New', 'Context', 'Decision', 'user2');
      await service.accept(newAdr.id, 'user2');

      await service.supersede(oldAdr.id, newAdr.id);

      await expect(service.reject(oldAdr.id, 'Reason', 'user3')).rejects.toThrow('Cannot reject');
    });
  });

  describe('State history', () => {
    it('should update updatedAt on each transition', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      const originalUpdatedAt = adr.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 50));

      const accepted = await service.accept(adr.id, 'user2');
      expect(accepted.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should update updatedBy on each transition', async () => {
      const adr = await service.propose('Test', 'Context', 'Decision', 'user1');
      expect(adr.updatedBy).toBe('user1');

      const accepted = await service.accept(adr.id, 'user2');
      expect(accepted.updatedBy).toBe('user2');

      const deprecated = await service.deprecate(adr.id, 'Reason', 'user3');
      expect(deprecated.updatedBy).toBe('user3');
    });
  });
});
