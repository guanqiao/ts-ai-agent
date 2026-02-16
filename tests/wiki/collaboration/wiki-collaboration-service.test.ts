import * as path from 'path';
import * as fs from 'fs/promises';
import {
  WikiCollaborationService,
  WikiPermissionService,
  WikiLockService,
  ROLE_PERMISSIONS,
} from '../../../src/wiki/collaboration';

describe('WikiCollaborationService', () => {
  let service: WikiCollaborationService;
  const testPath = path.join(__dirname, 'test-collaboration');

  beforeAll(async () => {
    await fs.mkdir(testPath, { recursive: true });
    service = new WikiCollaborationService(testPath);
    await service.initialize();
  });

  afterAll(async () => {
    await fs.rm(testPath, { recursive: true, force: true });
  });

  describe('addContributor', () => {
    it('should add a new contributor', async () => {
      const contributor = await service.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor',
        permissions: [],
      });

      expect(contributor).toBeDefined();
      expect(contributor.name).toBe('Test User');
      expect(contributor.email).toBe('test@example.com');
      expect(contributor.role).toBe('editor');
      expect(contributor.permissions).toEqual(ROLE_PERMISSIONS['editor']);
      expect(contributor.id).toBeDefined();
      expect(contributor.joinedAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate email', async () => {
      await service.addContributor({
        name: 'User 1',
        email: 'duplicate@example.com',
        role: 'viewer',
        permissions: [],
      });

      await expect(
        service.addContributor({
          name: 'User 2',
          email: 'duplicate@example.com',
          role: 'editor',
          permissions: [],
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('getContributor', () => {
    it('should return contributor by id', async () => {
      const added = await service.addContributor({
        name: 'Get Test',
        email: 'gettest@example.com',
        role: 'viewer',
        permissions: [],
      });

      const found = await service.getContributor(added.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Get Test');
    });

    it('should return null for non-existent contributor', async () => {
      const found = await service.getContributor('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getContributors', () => {
    it('should return all contributors', async () => {
      const contributors = await service.getContributors();
      expect(contributors.length).toBeGreaterThan(0);
    });
  });

  describe('updateContributorRole', () => {
    it('should update contributor role', async () => {
      const added = await service.addContributor({
        name: 'Role Update',
        email: 'roleupdate@example.com',
        role: 'viewer',
        permissions: [],
      });

      const updated = await service.updateContributorRole(added.id, 'editor');
      expect(updated.role).toBe('editor');
      expect(updated.permissions).toEqual(ROLE_PERMISSIONS['editor']);
    });
  });

  describe('removeContributor', () => {
    it('should remove contributor', async () => {
      const added = await service.addContributor({
        name: 'Remove Test',
        email: 'removetest@example.com',
        role: 'viewer',
        permissions: [],
      });

      const removed = await service.removeContributor(added.id);
      expect(removed).toBe(true);

      const found = await service.getContributor(added.id);
      expect(found).toBeNull();
    });
  });

  describe('saveUserConfig', () => {
    it('should save and load user config', async () => {
      const config = {
        userId: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com',
        notificationPreferences: {
          onPageUpdate: true,
          onPageDelete: true,
          onPermissionChange: false,
          onLockAcquire: false,
          onLockRelease: false,
          onMention: true,
          digestEnabled: false,
          digestFrequency: 'never' as const,
        },
        editorPreferences: {
          defaultFormat: 'markdown' as const,
          autoSave: true,
          autoSaveInterval: 30000,
          spellCheck: true,
          theme: 'auto' as const,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.saveUserConfig(config);
      const loaded = await service.loadUserConfig('user-123');

      expect(loaded).toBeDefined();
      expect(loaded?.displayName).toBe('Test User');
      expect(loaded?.notificationPreferences.onPageUpdate).toBe(true);
    });
  });
});

describe('WikiPermissionService', () => {
  let collaborationService: WikiCollaborationService;
  let permissionService: WikiPermissionService;
  const testPath = path.join(__dirname, 'test-permission');

  beforeAll(async () => {
    await fs.mkdir(testPath, { recursive: true });
    collaborationService = new WikiCollaborationService(testPath);
    await collaborationService.initialize();
    permissionService = new WikiPermissionService(testPath, collaborationService);
    await permissionService.initialize();
  });

  afterAll(async () => {
    await fs.rm(testPath, { recursive: true, force: true });
  });

  describe('getRolePermissions', () => {
    it('should return correct permissions for each role', () => {
      expect(permissionService.getRolePermissions('owner')).toContain('admin');
      expect(permissionService.getRolePermissions('admin')).toContain('manage_contributors');
      expect(permissionService.getRolePermissions('editor')).toContain('write');
      expect(permissionService.getRolePermissions('viewer')).toContain('read');
      expect(permissionService.getRolePermissions('viewer')).not.toContain('write');
    });
  });

  describe('checkPermission', () => {
    it('should check permission based on role', async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Perm Test',
        email: 'permtest@example.com',
        role: 'editor',
        permissions: [],
      });

      const hasRead = await permissionService.checkPermission('page-1', contributor.id, 'read');
      const hasWrite = await permissionService.checkPermission('page-1', contributor.id, 'write');
      const hasAdmin = await permissionService.checkPermission('page-1', contributor.id, 'admin');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(true);
      expect(hasAdmin).toBe(false);
    });
  });

  describe('setPermission', () => {
    it('should set custom permissions for a page', async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Custom Perm',
        email: 'customperm@example.com',
        role: 'editor',
        permissions: [],
      });

      await permissionService.setPermission('page-2', contributor.id, ['read']);

      const permissions = await permissionService.getPermissions('page-2', contributor.id);
      expect(permissions).toContain('read');
      expect(permissions).not.toContain('write');
    });
  });
});

describe('WikiLockService', () => {
  let lockService: WikiLockService;
  const testPath = path.join(__dirname, 'test-lock');

  beforeAll(async () => {
    await fs.mkdir(testPath, { recursive: true });
    lockService = new WikiLockService(testPath);
    await lockService.initialize();
  });

  afterAll(async () => {
    lockService.stopLockMonitor();
    await fs.rm(testPath, { recursive: true, force: true });
  });

  describe('lockPage', () => {
    it('should lock a page', async () => {
      const lock = await lockService.lockPage('page-1', 'user-1', 'Editing');

      expect(lock).toBeDefined();
      expect(lock.pageId).toBe('page-1');
      expect(lock.lockedBy).toBe('user-1');
      expect(lock.reason).toBe('Editing');
      expect(lock.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error when locking already locked page', async () => {
      await lockService.lockPage('page-2', 'user-1');

      await expect(lockService.lockPage('page-2', 'user-2')).rejects.toThrow('already locked');
    });
  });

  describe('getLockStatus', () => {
    it('should return lock status for locked page', async () => {
      await lockService.lockPage('page-3', 'user-1');

      const status = await lockService.getLockStatus('page-3');
      expect(status.isLocked).toBe(true);
      expect(status.lockedBy).toBe('user-1');
    });

    it('should return unlocked status for unlocked page', async () => {
      const status = await lockService.getLockStatus('non-existent-page');
      expect(status.isLocked).toBe(false);
      expect(status.canAcquire).toBe(true);
    });
  });

  describe('unlockPage', () => {
    it('should unlock a page', async () => {
      await lockService.lockPage('page-4', 'user-1');

      const result = await lockService.unlockPage('page-4', 'user-1');
      expect(result).toBe(true);

      const status = await lockService.getLockStatus('page-4');
      expect(status.isLocked).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create an edit session', async () => {
      const session = await lockService.createSession('page-5', 'user-1', 'Test User');

      expect(session).toBeDefined();
      expect(session.pageId).toBe('page-5');
      expect(session.userId).toBe('user-1');
      expect(session.userName).toBe('Test User');
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for a page', async () => {
      await lockService.createSession('page-6', 'user-1', 'User 1');
      await lockService.createSession('page-6', 'user-2', 'User 2');

      const sessions = await lockService.getActiveSessions('page-6');
      expect(sessions.length).toBe(2);
    });
  });

  describe('endSession', () => {
    it('should end a session', async () => {
      const session = await lockService.createSession('page-7', 'user-1', 'User 1');

      await lockService.endSession(session.id);

      const sessions = await lockService.getActiveSessions('page-7');
      expect(sessions.length).toBe(0);
    });
  });
});
