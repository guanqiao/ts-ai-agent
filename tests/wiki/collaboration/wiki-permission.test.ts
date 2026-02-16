import * as path from 'path';
import * as fs from 'fs';
import { WikiPermissionService } from '../../../src/wiki/collaboration/wiki-permission';
import { WikiCollaborationService } from '../../../src/wiki/collaboration/wiki-collaboration-service';
import { WikiPage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';

describe('WikiPermissionService', () => {
  let permissionService: WikiPermissionService;
  let collaborationService: WikiCollaborationService;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-permission-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    collaborationService = new WikiCollaborationService(testProjectPath);
    await collaborationService.initialize();

    permissionService = new WikiPermissionService(testProjectPath, collaborationService);
    await permissionService.initialize();
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new WikiPermissionService(testProjectPath, collaborationService);
      await newService.initialize();
      
      expect(newService).toBeDefined();
    });
  });

  describe('setPermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;
    });

    it('should set permissions for a user on a page', async () => {
      await permissionService.setPermission('page-1', contributorId, ['read', 'write']);

      const permissions = await permissionService.getPermissions('page-1', contributorId);
      expect(permissions).toContain('read');
      expect(permissions).toContain('write');
    });

    it('should only allow valid permissions for user role', async () => {
      await permissionService.setPermission('page-1', contributorId, ['read', 'admin']);

      const permissions = await permissionService.getPermissions('page-1', contributorId);
      expect(permissions).toContain('read');
      expect(permissions).not.toContain('admin');
    });

    it('should throw error for non-contributor user', async () => {
      await expect(
        permissionService.setPermission('page-1', 'non-existent', ['read'])
      ).rejects.toThrow('not a contributor');
    });
  });

  describe('getPermissions', () => {
    it('should return role-based permissions by default', async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'share', 'export', 'manage_contributors'],
      });

      const permissions = await permissionService.getPermissions('page-1', contributor.id);
      expect(permissions).toContain('manage_contributors');
    });

    it('should return empty array for non-existent user', async () => {
      const permissions = await permissionService.getPermissions('page-1', 'non-existent');
      expect(permissions).toEqual([]);
    });
  });

  describe('checkPermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Editor User',
        email: 'editor@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;
    });

    it('should return true for allowed permission', async () => {
      const hasPermission = await permissionService.checkPermission('page-1', contributorId, 'write');
      expect(hasPermission).toBe(true);
    });

    it('should return false for denied permission', async () => {
      const hasPermission = await permissionService.checkPermission('page-1', contributorId, 'admin');
      expect(hasPermission).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const hasPermission = await permissionService.checkPermission('page-1', 'non-existent', 'read');
      expect(hasPermission).toBe(false);
    });
  });

  describe('assignRole', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        permissions: ['read'],
      });
      contributorId = contributor.id;
    });

    it('should assign role to user on a page', async () => {
      await permissionService.assignRole('page-1', contributorId, 'editor');

      const role = await permissionService.getRole('page-1', contributorId);
      expect(role).toBe('editor');
    });

    it('should set role-based permissions when assigning role', async () => {
      await permissionService.assignRole('page-1', contributorId, 'admin');

      const permissions = await permissionService.getPermissions('page-1', contributorId);
      expect(permissions).toContain('manage_contributors');
    });

    it('should throw error for non-contributor user', async () => {
      await expect(
        permissionService.assignRole('page-1', 'non-existent', 'editor')
      ).rejects.toThrow('not a contributor');
    });
  });

  describe('getRole', () => {
    it('should return user role from collaboration service', async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Editor User',
        email: 'editor@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });

      const role = await permissionService.getRole('page-1', contributor.id);
      expect(role).toBe('editor');
    });

    it('should return page-specific role if set', async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        permissions: ['read'],
      });

      await permissionService.assignRole('page-1', contributor.id, 'admin');

      const role = await permissionService.getRole('page-1', contributor.id);
      expect(role).toBe('admin');
    });

    it('should return viewer for non-existent user', async () => {
      const role = await permissionService.getRole('page-1', 'non-existent');
      expect(role).toBe('viewer');
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for owner role', () => {
      const permissions = permissionService.getRolePermissions('owner');
      expect(permissions).toContain('admin');
      expect(permissions).toContain('manage_permissions');
    });

    it('should return permissions for viewer role', () => {
      const permissions = permissionService.getRolePermissions('viewer');
      expect(permissions).toEqual(['read']);
    });

    it('should return empty array for unknown role', () => {
      const permissions = permissionService.getRolePermissions('unknown' as any);
      expect(permissions).toEqual([]);
    });
  });

  describe('requirePermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Editor User',
        email: 'editor@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;
    });

    it('should return true when user has required permission', async () => {
      const checkWrite = permissionService.requirePermission('write');
      const result = await checkWrite(contributorId, 'page-1');
      expect(result).toBe(true);
    });

    it('should return false when user lacks required permission', async () => {
      const checkAdmin = permissionService.requirePermission('admin');
      const result = await checkAdmin(contributorId, 'page-1');
      expect(result).toBe(false);
    });

    it('should work without pageId', async () => {
      const checkWrite = permissionService.requirePermission('write');
      const result = await checkWrite(contributorId);
      expect(result).toBe(true);
    });
  });

  describe('filterByPermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Viewer User',
        email: 'viewer@example.com',
        role: 'viewer',
        permissions: ['read'],
      });
      contributorId = contributor.id;
    });

    it('should filter pages by permission', async () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Page 1',
          slug: 'page-1',
          content: 'Content 1',
          format: DocumentFormat.Markdown,
          metadata: {
            tags: [],
            category: 'overview',
            sourceFiles: [],
            language: Language.TypeScript,
          },
          sections: [],
          links: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          id: 'page-2',
          title: 'Page 2',
          slug: 'page-2',
          content: 'Content 2',
          format: DocumentFormat.Markdown,
          metadata: {
            tags: [],
            category: 'api',
            sourceFiles: [],
            language: Language.TypeScript,
          },
          sections: [],
          links: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
      ];

      const filtered = await permissionService.filterByPermission(contributorId, pages, 'read');
      expect(filtered.length).toBe(2);
    });

    it('should return empty array when no pages match', async () => {
      const pages: WikiPage[] = [
        {
          id: 'page-1',
          title: 'Page 1',
          slug: 'page-1',
          content: 'Content',
          format: DocumentFormat.Markdown,
          metadata: {
            tags: [],
            category: 'overview',
            sourceFiles: [],
            language: Language.TypeScript,
          },
          sections: [],
          links: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
      ];

      const filtered = await permissionService.filterByPermission(contributorId, pages, 'write');
      expect(filtered.length).toBe(0);
    });
  });

  describe('hasAnyPermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Editor User',
        email: 'editor@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;
    });

    it('should return true if user has any of the permissions', async () => {
      const result = await permissionService.hasAnyPermission(contributorId, ['admin', 'write', 'delete']);
      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', async () => {
      const result = await permissionService.hasAnyPermission(contributorId, ['admin', 'delete', 'manage_contributors']);
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await permissionService.hasAnyPermission('non-existent', ['read']);
      expect(result).toBe(false);
    });
  });

  describe('global permissions', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        permissions: ['read'],
      });
      contributorId = contributor.id;
    });

    it('should grant global permission', async () => {
      await permissionService.grantGlobalPermission(contributorId, 'write');

      const result = await permissionService.hasAnyPermission(contributorId, ['write']);
      expect(result).toBe(true);
    });

    it('should revoke global permission', async () => {
      await permissionService.grantGlobalPermission(contributorId, 'write');
      await permissionService.revokeGlobalPermission(contributorId, 'write');

      const result = await permissionService.hasAnyPermission(contributorId, ['write']);
      expect(result).toBe(false);
    });

    it('should throw error for non-contributor', async () => {
      await expect(
        permissionService.grantGlobalPermission('non-existent', 'write')
      ).rejects.toThrow('not a contributor');
    });
  });

  describe('removePagePermissions', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;

      await permissionService.setPermission('page-1', contributorId, ['read', 'write']);
    });

    it('should remove all permissions for a page', async () => {
      await permissionService.removePagePermissions('page-1');

      const permissions = await permissionService.getPermissions('page-1', contributorId);
      expect(permissions).toContain('read');
    });
  });

  describe('getUserPagesWithPermission', () => {
    let contributorId: string;

    beforeEach(async () => {
      const contributor = await collaborationService.addContributor({
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      contributorId = contributor.id;

      await permissionService.setPermission('page-1', contributorId, ['read', 'write']);
      await permissionService.setPermission('page-2', contributorId, ['read']);
    });

    it('should return pages where user has specific permission', async () => {
      const pages = await permissionService.getUserPagesWithPermission(contributorId, 'write');
      expect(pages).toContain('page-1');
      expect(pages).not.toContain('page-2');
    });
  });

  describe('canManageUser', () => {
    let ownerId: string;
    let editorId: string;

    beforeEach(async () => {
      const owner = await collaborationService.addContributor({
        name: 'Owner',
        email: 'owner@example.com',
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin', 'share', 'export', 'manage_contributors', 'manage_permissions'],
      });
      ownerId = owner.id;

      const editor = await collaborationService.addContributor({
        name: 'Editor',
        email: 'editor@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });
      editorId = editor.id;
    });

    it('should return true when actor has higher role', async () => {
      const result = await permissionService.canManageUser(ownerId, editorId);
      expect(result).toBe(true);
    });

    it('should return false when actor has lower role', async () => {
      const result = await permissionService.canManageUser(editorId, ownerId);
      expect(result).toBe(false);
    });

    it('should return false for same role', async () => {
      const editor2 = await collaborationService.addContributor({
        name: 'Editor 2',
        email: 'editor2@example.com',
        role: 'editor',
        permissions: ['read', 'write', 'export'],
      });

      const result = await permissionService.canManageUser(editorId, editor2.id);
      expect(result).toBe(false);
    });
  });
});
