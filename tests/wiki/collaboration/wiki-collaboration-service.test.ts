import * as path from 'path';
import * as fs from 'fs';
import { WikiCollaborationService } from '../../../src/wiki/collaboration/wiki-collaboration-service';
import { WikiUserConfig, WikiRole } from '../../../src/wiki/collaboration/types';

describe('WikiCollaborationService', () => {
  let service: WikiCollaborationService;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-collab-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    service = new WikiCollaborationService(testProjectPath);
    await service.initialize();
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new WikiCollaborationService(testProjectPath);
      await newService.initialize();
      
      expect(newService.isInitialized()).toBe(true);
    });

    it('should load existing contributors on init', async () => {
      // Add a contributor first
      await service.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      // Create new service instance to test loading
      const newService = new WikiCollaborationService(testProjectPath);
      await newService.initialize();

      const contributors = await newService.getContributors();
      expect(contributors.length).toBe(1);
      expect(contributors[0].email).toBe('test@example.com');
    });
  });

  describe('addContributor', () => {
    it('should add a new contributor', async () => {
      const contributor = await service.addContributor({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      expect(contributor).toBeDefined();
      expect(contributor.id).toBeDefined();
      expect(contributor.name).toBe('John Doe');
      expect(contributor.email).toBe('john@example.com');
      expect(contributor.role).toBe('editor');
      expect(contributor.joinedAt).toBeInstanceOf(Date);
      expect(contributor.contributionCount).toBe(0);
    });

    it('should assign role permissions automatically', async () => {
      const contributor = await service.addContributor({
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'share', 'export', 'manage_contributors'],
      });

      expect(contributor.permissions).toContain('read');
      expect(contributor.permissions).toContain('write');
      expect(contributor.permissions).toContain('delete');
    });

    it('should throw error for duplicate email', async () => {
      await service.addContributor({
        name: 'User One',
        email: 'duplicate@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      await expect(
        service.addContributor({
          name: 'User Two',
          email: 'duplicate@example.com',
          role: 'editor',
          permissions: ['read', 'write'],
        })
      ).rejects.toThrow('already exists');
    });

    it('should support all roles', async () => {
      const roles: WikiRole[] = ['owner', 'admin', 'editor', 'contributor', 'viewer'];

      for (let i = 0; i < roles.length; i++) {
        const contributor = await service.addContributor({
          name: `User ${roles[i]}`,
          email: `user${i}@example.com`,
          role: roles[i],
          permissions: ['read'],
        });

        expect(contributor.role).toBe(roles[i]);
      }
    });
  });

  describe('removeContributor', () => {
    it('should remove a contributor', async () => {
      const contributor = await service.addContributor({
        name: 'To Remove',
        email: 'remove@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      const result = await service.removeContributor(contributor.id);
      
      expect(result).toBe(true);
      
      const retrieved = await service.getContributor(contributor.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent contributor', async () => {
      const result = await service.removeContributor('non-existent-id');
      expect(result).toBe(false);
    });

    it('should not remove the last owner', async () => {
      const owner = await service.addContributor({
        name: 'Owner',
        email: 'owner@example.com',
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin', 'share', 'export', 'manage_contributors', 'manage_permissions'],
      });

      await expect(service.removeContributor(owner.id)).rejects.toThrow('last owner');
    });

    it('should allow removing owner if multiple exist', async () => {
      const owner1 = await service.addContributor({
        name: 'Owner 1',
        email: 'owner1@example.com',
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin', 'share', 'export', 'manage_contributors', 'manage_permissions'],
      });

      await service.addContributor({
        name: 'Owner 2',
        email: 'owner2@example.com',
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin', 'share', 'export', 'manage_contributors', 'manage_permissions'],
      });

      const result = await service.removeContributor(owner1.id);
      expect(result).toBe(true);
    });
  });

  describe('getContributor', () => {
    it('should get a contributor by id', async () => {
      const added = await service.addContributor({
        name: 'Test User',
        email: 'get@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      const retrieved = await service.getContributor(added.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.email).toBe('get@example.com');
    });

    it('should return null for non-existent contributor', async () => {
      const result = await service.getContributor('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getContributors', () => {
    it('should return all contributors', async () => {
      await service.addContributor({
        name: 'User 1',
        email: 'user1@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      await service.addContributor({
        name: 'User 2',
        email: 'user2@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      const contributors = await service.getContributors();

      expect(contributors.length).toBe(2);
    });

    it('should return empty array when no contributors', async () => {
      const contributors = await service.getContributors();
      expect(contributors).toEqual([]);
    });
  });

  describe('updateContributorRole', () => {
    it('should update contributor role', async () => {
      const contributor = await service.addContributor({
        name: 'Role Test',
        email: 'role@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      const updated = await service.updateContributorRole(contributor.id, 'admin');

      expect(updated.role).toBe('admin');
      expect(updated.permissions).toContain('manage_contributors');
    });

    it('should throw error for non-existent contributor', async () => {
      await expect(
        service.updateContributorRole('non-existent', 'admin')
      ).rejects.toThrow('not found');
    });

    it('should not demote the last owner', async () => {
      const owner = await service.addContributor({
        name: 'Only Owner',
        email: 'onlyowner@example.com',
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin', 'share', 'export', 'manage_contributors', 'manage_permissions'],
      });

      await expect(
        service.updateContributorRole(owner.id, 'admin')
      ).rejects.toThrow('last owner');
    });

    it('should update lastActiveAt on role change', async () => {
      const contributor = await service.addContributor({
        name: 'Active Test',
        email: 'active@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      const beforeUpdate = contributor.lastActiveAt;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await service.updateContributorRole(contributor.id, 'editor');
      
      expect(updated.lastActiveAt.getTime()).toBeGreaterThan(beforeUpdate.getTime());
    });
  });

  describe('updateContributorPermissions', () => {
    it('should update contributor permissions', async () => {
      const contributor = await service.addContributor({
        name: 'Permission Test',
        email: 'perm@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      const updated = await service.updateContributorPermissions(contributor.id, ['read', 'write', 'export']);

      expect(updated.permissions).toContain('read');
      expect(updated.permissions).toContain('write');
      expect(updated.permissions).toContain('export');
    });

    it('should only allow valid permissions for role', async () => {
      const contributor = await service.addContributor({
        name: 'Limited User',
        email: 'limited@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      // Try to assign admin permission to viewer
      const updated = await service.updateContributorPermissions(contributor.id, ['read', 'admin']);

      // Should only keep valid permissions for the role
      expect(updated.permissions).toContain('read');
      expect(updated.permissions).not.toContain('admin');
    });

    it('should throw error for non-existent contributor', async () => {
      await expect(
        service.updateContributorPermissions('non-existent', ['read'])
      ).rejects.toThrow('not found');
    });
  });

  describe('incrementContribution', () => {
    it('should increment contribution count', async () => {
      const contributor = await service.addContributor({
        name: 'Contributor',
        email: 'contrib@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      await service.incrementContribution(contributor.id);
      await service.incrementContribution(contributor.id);

      const updated = await service.getContributor(contributor.id);
      expect(updated?.contributionCount).toBe(2);
    });

    it('should update lastActiveAt on contribution', async () => {
      const contributor = await service.addContributor({
        name: 'Active Contributor',
        email: 'activecontrib@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });

      const beforeIncrement = contributor.lastActiveAt;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.incrementContribution(contributor.id);

      const updated = await service.getContributor(contributor.id);
      expect(updated?.lastActiveAt.getTime()).toBeGreaterThan(beforeIncrement.getTime());
    });

    it('should handle non-existent contributor gracefully', async () => {
      // Should not throw
      await expect(service.incrementContribution('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getContributorsByRole', () => {
    it('should filter contributors by role', async () => {
      await service.addContributor({
        name: 'Admin 1',
        email: 'admin1@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'share', 'export', 'manage_contributors'],
      });

      await service.addContributor({
        name: 'Editor 1',
        email: 'editor1@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });

      await service.addContributor({
        name: 'Admin 2',
        email: 'admin2@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'share', 'export', 'manage_contributors'],
      });

      const admins = service.getContributorsByRole('admin');
      expect(admins.length).toBe(2);
      expect(admins.every(a => a.role === 'admin')).toBe(true);
    });

    it('should return empty array when no contributors with role', () => {
      const owners = service.getContributorsByRole('owner');
      expect(owners).toEqual([]);
    });
  });

  describe('getContributorsWithPermission', () => {
    it('should filter contributors by permission', async () => {
      await service.addContributor({
        name: 'Admin User',
        email: 'adminperm@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'share', 'export', 'manage_contributors'],
      });

      await service.addContributor({
        name: 'Viewer User',
        email: 'viewerperm@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      const writers = service.getContributorsWithPermission('write');
      expect(writers.length).toBe(1);
      expect(writers[0].email).toBe('adminperm@example.com');
    });
  });

  describe('User Config', () => {
    it('should save and load user config', async () => {
      const config: WikiUserConfig = {
        userId: 'user-123',
        displayName: 'Test User',
        email: 'config@example.com',
        notificationPreferences: {
          onPageUpdate: true,
          onPageDelete: false,
          onPermissionChange: true,
          onLockAcquire: false,
          onLockRelease: false,
          onMention: true,
          digestEnabled: false,
          digestFrequency: 'never',
        },
        editorPreferences: {
          defaultFormat: 'markdown',
          autoSave: true,
          autoSaveInterval: 30000,
          spellCheck: true,
          theme: 'light',
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

    it('should create default user config', async () => {
      const config = await service.getOrCreateUserConfig(
        'new-user',
        'New User',
        'newuser@example.com'
      );

      expect(config.userId).toBe('new-user');
      expect(config.displayName).toBe('New User');
      expect(config.email).toBe('newuser@example.com');
      expect(config.notificationPreferences).toBeDefined();
      expect(config.editorPreferences).toBeDefined();
    });

    it('should return existing config if exists', async () => {
      await service.getOrCreateUserConfig('existing-user', 'Original Name', 'original@example.com');

      const config = await service.getOrCreateUserConfig(
        'existing-user',
        'New Name',
        'new@example.com'
      );

      // Should keep original values
      expect(config.displayName).toBe('Original Name');
    });

    it('should update updatedAt on save', async () => {
      const config = await service.getOrCreateUserConfig('update-test', 'Update Test', 'update@example.com');
      
      const originalUpdatedAt = config.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      config.displayName = 'Updated Name';
      await service.saveUserConfig(config);

      const loaded = await service.loadUserConfig('update-test');
      expect(loaded?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
