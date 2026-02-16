import * as path from 'path';
import * as fs from 'fs/promises';
import { WikiPage } from '../types';
import { WikiPermission, WikiRole, ROLE_PERMISSIONS, IWikiPermission } from './types';
import { WikiCollaborationService } from './wiki-collaboration-service';

interface PagePermission {
  pageId: string;
  userId: string;
  permissions: WikiPermission[];
  role: WikiRole;
  inherited: boolean;
}

export class WikiPermissionService implements IWikiPermission {
  private permissionsPath: string;
  private pagePermissions: Map<string, Map<string, PagePermission>> = new Map();
  private collaborationService: WikiCollaborationService;
  private globalPermissions: Map<string, WikiPermission[]> = new Map();

  constructor(projectPath: string, collaborationService: WikiCollaborationService) {
    this.permissionsPath = path.join(projectPath, '.wiki', 'permissions.json');
    this.collaborationService = collaborationService;
  }

  async initialize(): Promise<void> {
    await this.loadPermissions();
  }

  private async loadPermissions(): Promise<void> {
    try {
      const data = await fs.readFile(this.permissionsPath, 'utf-8');
      const permissions: PagePermission[] = JSON.parse(data);
      for (const perm of permissions) {
        if (!this.pagePermissions.has(perm.pageId)) {
          this.pagePermissions.set(perm.pageId, new Map());
        }
        this.pagePermissions.get(perm.pageId)!.set(perm.userId, perm);
      }
    } catch {
      this.pagePermissions.clear();
    }
  }

  private async savePermissions(): Promise<void> {
    const dir = path.dirname(this.permissionsPath);
    await fs.mkdir(dir, { recursive: true });
    const permissions: PagePermission[] = [];
    for (const [, userPerms] of this.pagePermissions) {
      for (const perm of userPerms.values()) {
        permissions.push(perm);
      }
    }
    await fs.writeFile(this.permissionsPath, JSON.stringify(permissions, null, 2), 'utf-8');
  }

  async setPermission(
    pageId: string,
    userId: string,
    permissions: WikiPermission[]
  ): Promise<void> {
    const contributor = await this.collaborationService.getContributor(userId);
    if (!contributor) {
      throw new Error(`User ${userId} is not a contributor`);
    }

    const rolePermissions = ROLE_PERMISSIONS[contributor.role] || [];
    const validPermissions = permissions.filter((p) => rolePermissions.includes(p));

    if (!this.pagePermissions.has(pageId)) {
      this.pagePermissions.set(pageId, new Map());
    }

    const existingPerm = this.pagePermissions.get(pageId)!.get(userId);
    const pagePerm: PagePermission = {
      pageId,
      userId,
      permissions: validPermissions,
      role: existingPerm?.role || contributor.role,
      inherited: false,
    };

    this.pagePermissions.get(pageId)!.set(userId, pagePerm);
    await this.savePermissions();
  }

  async getPermissions(pageId: string, userId: string): Promise<WikiPermission[]> {
    const pagePerms = this.pagePermissions.get(pageId);
    if (pagePerms) {
      const perm = pagePerms.get(userId);
      if (perm && !perm.inherited) {
        return perm.permissions;
      }
    }

    const contributor = await this.collaborationService.getContributor(userId);
    if (contributor) {
      return ROLE_PERMISSIONS[contributor.role] || [];
    }

    return [];
  }

  async checkPermission(
    pageId: string,
    userId: string,
    permission: WikiPermission
  ): Promise<boolean> {
    const permissions = await this.getPermissions(pageId, userId);
    return permissions.includes(permission);
  }

  async assignRole(pageId: string, userId: string, role: WikiRole): Promise<void> {
    const contributor = await this.collaborationService.getContributor(userId);
    if (!contributor) {
      throw new Error(`User ${userId} is not a contributor`);
    }

    if (!this.pagePermissions.has(pageId)) {
      this.pagePermissions.set(pageId, new Map());
    }

    const pagePerm: PagePermission = {
      pageId,
      userId,
      permissions: ROLE_PERMISSIONS[role] || [],
      role,
      inherited: false,
    };

    this.pagePermissions.get(pageId)!.set(userId, pagePerm);
    await this.savePermissions();
  }

  async getRole(pageId: string, userId: string): Promise<WikiRole> {
    const pagePerms = this.pagePermissions.get(pageId);
    if (pagePerms) {
      const perm = pagePerms.get(userId);
      if (perm) {
        return perm.role;
      }
    }

    const contributor = await this.collaborationService.getContributor(userId);
    return contributor?.role || 'viewer';
  }

  getRolePermissions(role: WikiRole): WikiPermission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  requirePermission(
    permission: WikiPermission
  ): (userId: string, pageId?: string) => Promise<boolean> {
    return async (userId: string, pageId?: string): Promise<boolean> => {
      if (pageId) {
        return this.checkPermission(pageId, userId, permission);
      }

      const contributor = await this.collaborationService.getContributor(userId);
      if (contributor) {
        return ROLE_PERMISSIONS[contributor.role].includes(permission);
      }

      return false;
    };
  }

  async filterByPermission(
    userId: string,
    pages: WikiPage[],
    permission: WikiPermission
  ): Promise<WikiPage[]> {
    const filteredPages: WikiPage[] = [];

    for (const page of pages) {
      const hasPermission = await this.checkPermission(page.id, userId, permission);
      if (hasPermission) {
        filteredPages.push(page);
      }
    }

    return filteredPages;
  }

  async hasAnyPermission(userId: string, permissions: WikiPermission[]): Promise<boolean> {
    const contributor = await this.collaborationService.getContributor(userId);
    if (!contributor) {
      return false;
    }

    const userPermissions = ROLE_PERMISSIONS[contributor.role];
    const globalPerms = this.globalPermissions.get(userId) || [];
    const allPermissions = [...userPermissions, ...globalPerms];
    
    return permissions.some((p) => allPermissions.includes(p));
  }

  async grantGlobalPermission(userId: string, permission: WikiPermission): Promise<void> {
    const contributor = await this.collaborationService.getContributor(userId);
    if (!contributor) {
      throw new Error(`User ${userId} is not a contributor`);
    }

    const currentPerms = this.globalPermissions.get(userId) || [];
    if (!currentPerms.includes(permission)) {
      currentPerms.push(permission);
      this.globalPermissions.set(userId, currentPerms);
    }
  }

  async revokeGlobalPermission(userId: string, permission: WikiPermission): Promise<void> {
    const currentPerms = this.globalPermissions.get(userId);
    if (currentPerms) {
      const filtered = currentPerms.filter((p) => p !== permission);
      if (filtered.length > 0) {
        this.globalPermissions.set(userId, filtered);
      } else {
        this.globalPermissions.delete(userId);
      }
    }
  }

  async removePagePermissions(pageId: string): Promise<void> {
    this.pagePermissions.delete(pageId);
    await this.savePermissions();
  }

  async getUserPagesWithPermission(userId: string, permission: WikiPermission): Promise<string[]> {
    const pageIds: string[] = [];

    for (const [pageId, userPerms] of this.pagePermissions) {
      const perm = userPerms.get(userId);
      if (perm && perm.permissions.includes(permission)) {
        pageIds.push(pageId);
      }
    }

    return pageIds;
  }

  async canManageUser(actorId: string, targetId: string): Promise<boolean> {
    const actorRole = await this.getRole('*', actorId);
    const targetRole = await this.getRole('*', targetId);

    const roleHierarchy: WikiRole[] = ['owner', 'admin', 'editor', 'contributor', 'viewer'];
    const actorIndex = roleHierarchy.indexOf(actorRole);
    const targetIndex = roleHierarchy.indexOf(targetRole);

    return actorIndex < targetIndex;
  }
}
