import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  WikiContributor,
  WikiRole,
  WikiPermission,
  WikiUserConfig,
  NotificationPreferences,
  EditorPreferences,
  ROLE_PERMISSIONS,
  IWikiCollaborationService,
} from './types';

export class WikiCollaborationService implements IWikiCollaborationService {
  private contributorsPath: string;
  private userConfigPath: string;
  private contributors: Map<string, WikiContributor> = new Map();
  private userConfigs: Map<string, WikiUserConfig> = new Map();
  private initialized: boolean = false;

  constructor(projectPath: string) {
    this.contributorsPath = path.join(projectPath, '.wiki', 'contributors.json');
    this.userConfigPath = path.join(projectPath, '.wiki', 'user-configs');
  }

  async initialize(): Promise<void> {
    await this.loadContributors();
    await this.loadUserConfigs();
    this.initialized = true;
  }

  private async loadContributors(): Promise<void> {
    try {
      const data = await fs.readFile(this.contributorsPath, 'utf-8');
      const contributors: WikiContributor[] = JSON.parse(data);
      for (const contributor of contributors) {
        contributor.joinedAt = new Date(contributor.joinedAt);
        contributor.lastActiveAt = new Date(contributor.lastActiveAt);
        this.contributors.set(contributor.id, contributor);
      }
    } catch {
      this.contributors.clear();
    }
  }

  private async saveContributors(): Promise<void> {
    const dir = path.dirname(this.contributorsPath);
    await fs.mkdir(dir, { recursive: true });
    const contributors = Array.from(this.contributors.values());
    await fs.writeFile(this.contributorsPath, JSON.stringify(contributors, null, 2), 'utf-8');
  }

  private async loadUserConfigs(): Promise<void> {
    try {
      const files = await fs.readdir(this.userConfigPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.userConfigPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const config: WikiUserConfig = JSON.parse(data);
          config.createdAt = new Date(config.createdAt);
          config.updatedAt = new Date(config.updatedAt);
          this.userConfigs.set(config.userId, config);
        }
      }
    } catch {
      this.userConfigs.clear();
    }
  }

  async addContributor(
    contributorData: Omit<WikiContributor, 'id' | 'joinedAt' | 'lastActiveAt' | 'contributionCount'>
  ): Promise<WikiContributor> {
    const existingContributor = this.findByEmail(contributorData.email);
    if (existingContributor) {
      throw new Error(`Contributor with email ${contributorData.email} already exists`);
    }

    const contributor: WikiContributor = {
      ...contributorData,
      id: this.generateId(),
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      contributionCount: 0,
    };

    if (!contributor.permissions || contributor.permissions.length === 0) {
      contributor.permissions = ROLE_PERMISSIONS[contributor.role] || [];
    }

    this.contributors.set(contributor.id, contributor);
    await this.saveContributors();

    return contributor;
  }

  async removeContributor(contributorId: string): Promise<boolean> {
    const contributor = this.contributors.get(contributorId);
    if (!contributor) {
      return false;
    }

    if (contributor.role === 'owner') {
      const owners = Array.from(this.contributors.values()).filter((c) => c.role === 'owner');
      if (owners.length <= 1) {
        throw new Error('Cannot remove the last owner');
      }
    }

    this.contributors.delete(contributorId);
    await this.saveContributors();
    return true;
  }

  async getContributor(contributorId: string): Promise<WikiContributor | null> {
    return this.contributors.get(contributorId) || null;
  }

  async getContributors(): Promise<WikiContributor[]> {
    return Array.from(this.contributors.values());
  }

  async updateContributorRole(contributorId: string, role: WikiRole): Promise<WikiContributor> {
    const contributor = this.contributors.get(contributorId);
    if (!contributor) {
      throw new Error(`Contributor ${contributorId} not found`);
    }

    if (contributor.role === 'owner' && role !== 'owner') {
      const owners = Array.from(this.contributors.values()).filter((c) => c.role === 'owner');
      if (owners.length <= 1) {
        throw new Error('Cannot demote the last owner');
      }
    }

    contributor.role = role;
    contributor.permissions = ROLE_PERMISSIONS[role] || [];
    contributor.lastActiveAt = new Date();

    await this.saveContributors();
    return contributor;
  }

  async updateContributorPermissions(
    contributorId: string,
    permissions: WikiPermission[]
  ): Promise<WikiContributor> {
    const contributor = this.contributors.get(contributorId);
    if (!contributor) {
      throw new Error(`Contributor ${contributorId} not found`);
    }

    const rolePermissions = ROLE_PERMISSIONS[contributor.role] || [];
    const validPermissions = permissions.filter((p) => rolePermissions.includes(p));

    contributor.permissions = validPermissions;
    contributor.lastActiveAt = new Date();

    await this.saveContributors();
    return contributor;
  }

  async incrementContribution(contributorId: string): Promise<void> {
    const contributor = this.contributors.get(contributorId);
    if (contributor) {
      contributor.contributionCount++;
      contributor.lastActiveAt = new Date();
      await this.saveContributors();
    }
  }

  async saveUserConfig(config: WikiUserConfig): Promise<void> {
    const existingConfig = this.userConfigs.get(config.userId);
    if (existingConfig) {
      config.createdAt = existingConfig.createdAt;
    }
    config.updatedAt = new Date();

    this.userConfigs.set(config.userId, config);

    const dir = this.userConfigPath;
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${config.userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async loadUserConfig(userId: string): Promise<WikiUserConfig | null> {
    return this.userConfigs.get(userId) || null;
  }

  async getOrCreateUserConfig(
    userId: string,
    displayName: string,
    email: string
  ): Promise<WikiUserConfig> {
    let config = await this.loadUserConfig(userId);
    if (!config) {
      config = this.createDefaultUserConfig(userId, displayName, email);
      await this.saveUserConfig(config);
    }
    return config;
  }

  private createDefaultUserConfig(
    userId: string,
    displayName: string,
    email: string
  ): WikiUserConfig {
    const now = new Date();
    return {
      userId,
      displayName,
      email,
      notificationPreferences: this.getDefaultNotificationPreferences(),
      editorPreferences: this.getDefaultEditorPreferences(),
      createdAt: now,
      updatedAt: now,
    };
  }

  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      onPageUpdate: true,
      onPageDelete: true,
      onPermissionChange: true,
      onLockAcquire: false,
      onLockRelease: false,
      onMention: true,
      digestEnabled: false,
      digestFrequency: 'never',
    };
  }

  private getDefaultEditorPreferences(): EditorPreferences {
    return {
      defaultFormat: 'markdown',
      autoSave: true,
      autoSaveInterval: 30000,
      spellCheck: true,
      theme: 'auto',
    };
  }

  private findByEmail(email: string): WikiContributor | undefined {
    return Array.from(this.contributors.values()).find((c) => c.email === email);
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  getContributorsByRole(role: WikiRole): WikiContributor[] {
    return Array.from(this.contributors.values()).filter((c) => c.role === role);
  }

  getContributorsWithPermission(permission: WikiPermission): WikiContributor[] {
    return Array.from(this.contributors.values()).filter((c) => c.permissions.includes(permission));
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
