import { WikiPage } from '../types';

export type WikiPermission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'share'
  | 'export'
  | 'manage_contributors'
  | 'manage_permissions';

export type WikiRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'contributor';

export interface WikiContributor {
  id: string;
  name: string;
  email: string;
  role: WikiRole;
  permissions: WikiPermission[];
  avatar?: string;
  joinedAt: Date;
  lastActiveAt: Date;
  contributionCount: number;
  metadata?: Record<string, unknown>;
}

export interface WikiUserConfig {
  userId: string;
  displayName: string;
  email: string;
  defaultRole?: WikiRole;
  notificationPreferences: NotificationPreferences;
  editorPreferences: EditorPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  onPageUpdate: boolean;
  onPageDelete: boolean;
  onPermissionChange: boolean;
  onLockAcquire: boolean;
  onLockRelease: boolean;
  onMention: boolean;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
}

export interface EditorPreferences {
  defaultFormat: 'markdown' | 'wysiwyg';
  autoSave: boolean;
  autoSaveInterval: number;
  spellCheck: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export const ROLE_PERMISSIONS: Record<WikiRole, WikiPermission[]> = {
  owner: [
    'read',
    'write',
    'delete',
    'admin',
    'share',
    'export',
    'manage_contributors',
    'manage_permissions',
  ],
  admin: [
    'read',
    'write',
    'delete',
    'share',
    'export',
    'manage_contributors',
  ],
  editor: ['read', 'write', 'export'],
  contributor: ['read', 'write'],
  viewer: ['read'],
};

export interface PageLock {
  id: string;
  pageId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  reason?: string;
  sessionId: string;
}

export interface LockStatus {
  isLocked: boolean;
  lock?: PageLock;
  canAcquire: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  expiresAt?: Date;
}

export interface EditSession {
  id: string;
  pageId: string;
  userId: string;
  userName: string;
  startedAt: Date;
  lastActivityAt: Date;
  clientInfo?: ClientInfo;
  changes: SessionChange[];
}

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}

export interface SessionChange {
  timestamp: Date;
  type: 'content' | 'metadata' | 'structure';
  description: string;
  details?: Record<string, unknown>;
}

export interface LockConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  enableAutoExtend: boolean;
  autoExtendIntervalMs: number;
  maxSessionsPerPage: number;
  cleanupIntervalMs: number;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = {
  defaultTimeoutMs: 30 * 60 * 1000,
  maxTimeoutMs: 4 * 60 * 60 * 1000,
  enableAutoExtend: true,
  autoExtendIntervalMs: 5 * 60 * 1000,
  maxSessionsPerPage: 5,
  cleanupIntervalMs: 60 * 1000,
};

export interface IWikiCollaborationService {
  initialize(): Promise<void>;
  addContributor(contributor: Omit<WikiContributor, 'id' | 'joinedAt' | 'lastActiveAt' | 'contributionCount'>): Promise<WikiContributor>;
  removeContributor(contributorId: string): Promise<boolean>;
  getContributor(contributorId: string): Promise<WikiContributor | null>;
  getContributors(): Promise<WikiContributor[]>;
  updateContributorRole(contributorId: string, role: WikiRole): Promise<WikiContributor>;
  updateContributorPermissions(contributorId: string, permissions: WikiPermission[]): Promise<WikiContributor>;
  saveUserConfig(config: WikiUserConfig): Promise<void>;
  loadUserConfig(userId: string): Promise<WikiUserConfig | null>;
}

export interface IWikiPermission {
  setPermission(pageId: string, userId: string, permissions: WikiPermission[]): Promise<void>;
  getPermissions(pageId: string, userId: string): Promise<WikiPermission[]>;
  checkPermission(pageId: string, userId: string, permission: WikiPermission): Promise<boolean>;
  assignRole(pageId: string, userId: string, role: WikiRole): Promise<void>;
  getRole(pageId: string, userId: string): Promise<WikiRole>;
  getRolePermissions(role: WikiRole): WikiPermission[];
  requirePermission(permission: WikiPermission): (userId: string, pageId?: string) => Promise<boolean>;
  filterByPermission(userId: string, pages: WikiPage[], permission: WikiPermission): Promise<WikiPage[]>;
}

export interface IWikiLock {
  lockPage(pageId: string, userId: string, reason?: string, timeoutMs?: number): Promise<PageLock>;
  unlockPage(pageId: string, userId: string): Promise<boolean>;
  getLockStatus(pageId: string): Promise<LockStatus>;
  extendLock(pageId: string, userId: string, additionalMs: number): Promise<PageLock>;
  startLockMonitor(): void;
  stopLockMonitor(): void;
  releaseExpiredLocks(): Promise<number>;
  createSession(pageId: string, userId: string, userName: string): Promise<EditSession>;
  updateSession(sessionId: string, change: Omit<SessionChange, 'timestamp'>): Promise<EditSession>;
  endSession(sessionId: string): Promise<void>;
  getActiveSessions(pageId: string): Promise<EditSession[]>;
}
