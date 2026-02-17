import {
  WikiSharingConfig,
  ShareResult,
  SyncResult,
  ShareStatus,
  Conflict,
  ConflictResolution,
  RemoteStatus,
  DEFAULT_SHARING_CONFIG,
} from '../../../src/wiki/sharing/types';

describe('WikiSharingConfig', () => {
  describe('DEFAULT_SHARING_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SHARING_CONFIG.enabled).toBe(false);
      expect(DEFAULT_SHARING_CONFIG.shareToGit).toBe(true);
      expect(DEFAULT_SHARING_CONFIG.sharePath).toBe('.tsdgen/wiki');
      expect(DEFAULT_SHARING_CONFIG.accessControl).toBe('team');
      expect(DEFAULT_SHARING_CONFIG.syncWithRemote).toBe(true);
      expect(DEFAULT_SHARING_CONFIG.autoCommit).toBe(true);
      expect(DEFAULT_SHARING_CONFIG.commitMessageTemplate).toBe(
        'docs: update wiki documentation [skip ci]'
      );
    });

    it('should have default exclude patterns', () => {
      expect(DEFAULT_SHARING_CONFIG.excludePatterns).toContain('.wiki/**/*.tmp');
      expect(DEFAULT_SHARING_CONFIG.excludePatterns).toContain('.wiki/**/*.bak');
      expect(DEFAULT_SHARING_CONFIG.excludePatterns).toContain('.wiki/vectors/**');
    });

    it('should have default include patterns', () => {
      expect(DEFAULT_SHARING_CONFIG.includePatterns).toContain('**/*.md');
      expect(DEFAULT_SHARING_CONFIG.includePatterns).toContain('**/*.json');
    });
  });

  describe('config validation', () => {
    it('should accept valid config', () => {
      const config: WikiSharingConfig = {
        enabled: true,
        shareToGit: true,
        sharePath: '.wiki',
        accessControl: 'public',
        syncWithRemote: true,
        autoCommit: false,
        commitMessageTemplate: 'custom message',
        excludePatterns: [],
        includePatterns: ['**/*.md'],
      };

      expect(config.enabled).toBe(true);
      expect(config.sharePath).toBe('.wiki');
      expect(config.accessControl).toBe('public');
    });

    it('should accept all access control values', () => {
      const publicConfig: WikiSharingConfig = {
        ...DEFAULT_SHARING_CONFIG,
        accessControl: 'public',
      };
      const teamConfig: WikiSharingConfig = {
        ...DEFAULT_SHARING_CONFIG,
        accessControl: 'team',
      };
      const privateConfig: WikiSharingConfig = {
        ...DEFAULT_SHARING_CONFIG,
        accessControl: 'private',
      };

      expect(publicConfig.accessControl).toBe('public');
      expect(teamConfig.accessControl).toBe('team');
      expect(privateConfig.accessControl).toBe('private');
    });

    it('should handle empty patterns', () => {
      const config: WikiSharingConfig = {
        ...DEFAULT_SHARING_CONFIG,
        excludePatterns: [],
        includePatterns: [],
      };

      expect(config.excludePatterns).toEqual([]);
      expect(config.includePatterns).toEqual([]);
    });

    it('should handle custom patterns', () => {
      const config: WikiSharingConfig = {
        ...DEFAULT_SHARING_CONFIG,
        excludePatterns: ['**/*.secret', '**/private/**'],
        includePatterns: ['**/*.md', '**/*.txt'],
      };

      expect(config.excludePatterns).toContain('**/*.secret');
      expect(config.includePatterns).toContain('**/*.txt');
    });
  });

  describe('config merging', () => {
    it('should merge partial config with defaults', () => {
      const partialConfig: Partial<WikiSharingConfig> = {
        enabled: true,
        sharePath: 'custom/wiki',
      };

      const mergedConfig = { ...DEFAULT_SHARING_CONFIG, ...partialConfig };

      expect(mergedConfig.enabled).toBe(true);
      expect(mergedConfig.sharePath).toBe('custom/wiki');
      expect(mergedConfig.shareToGit).toBe(DEFAULT_SHARING_CONFIG.shareToGit);
      expect(mergedConfig.accessControl).toBe(DEFAULT_SHARING_CONFIG.accessControl);
    });

    it('should override all defaults when full config provided', () => {
      const fullConfig: WikiSharingConfig = {
        enabled: true,
        shareToGit: false,
        sharePath: 'wiki',
        accessControl: 'private',
        syncWithRemote: false,
        autoCommit: false,
        commitMessageTemplate: 'wiki update',
        excludePatterns: ['**/*.log'],
        includePatterns: ['**/*.md'],
      };

      expect(fullConfig.enabled).toBe(true);
      expect(fullConfig.shareToGit).toBe(false);
      expect(fullConfig.syncWithRemote).toBe(false);
      expect(fullConfig.autoCommit).toBe(false);
    });
  });
});

describe('ShareResult', () => {
  it('should create successful share result', () => {
    const result: ShareResult = {
      success: true,
      message: 'Shared successfully',
      sharedPath: 'docs/wiki',
      commitHash: 'abc123',
      filesShared: 5,
      timestamp: new Date(),
      errors: [],
    };

    expect(result.success).toBe(true);
    expect(result.filesShared).toBe(5);
    expect(result.errors).toEqual([]);
  });

  it('should create failed share result with errors', () => {
    const result: ShareResult = {
      success: false,
      message: 'Share failed',
      filesShared: 0,
      timestamp: new Date(),
      errors: [
        {
          code: 'GIT_ERROR',
          message: 'Failed to commit',
          filePath: 'docs/wiki/page.md',
        },
      ],
    };

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].code).toBe('GIT_ERROR');
  });
});

describe('SyncResult', () => {
  it('should create successful sync result', () => {
    const result: SyncResult = {
      success: true,
      message: 'Synced successfully',
      direction: 'both',
      filesSynced: 3,
      conflicts: [],
      timestamp: new Date(),
      errors: [],
    };

    expect(result.success).toBe(true);
    expect(result.direction).toBe('both');
    expect(result.conflicts).toEqual([]);
  });

  it('should create sync result with conflicts', () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'local content',
        hash: 'local-hash',
        author: 'user1',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: 'remote content',
        hash: 'remote-hash',
        author: 'user2',
        timestamp: new Date(),
      },
      severity: 'medium',
      suggestedResolution: 'merge',
      resolved: false,
    };

    const result: SyncResult = {
      success: false,
      message: 'Sync blocked by conflicts',
      direction: 'pull',
      filesSynced: 0,
      conflicts: [conflict],
      timestamp: new Date(),
      errors: [],
    };

    expect(result.success).toBe(false);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].severity).toBe('medium');
  });
});

describe('ShareStatus', () => {
  it('should create initial share status', () => {
    const remoteStatus: RemoteStatus = {
      connected: false,
      branch: '',
      ahead: 0,
      behind: 0,
      lastFetchAt: null,
    };

    const status: ShareStatus = {
      isShared: false,
      sharePath: '',
      lastSharedAt: null,
      lastSyncedAt: null,
      pendingChanges: false,
      remoteStatus,
      conflicts: [],
    };

    expect(status.isShared).toBe(false);
    expect(status.remoteStatus.connected).toBe(false);
  });

  it('should create active share status', () => {
    const remoteStatus: RemoteStatus = {
      connected: true,
      branch: 'main',
      ahead: 2,
      behind: 1,
      lastFetchAt: new Date(),
    };

    const status: ShareStatus = {
      isShared: true,
      sharePath: 'docs/wiki',
      lastSharedAt: new Date(),
      lastSyncedAt: new Date(),
      pendingChanges: true,
      remoteStatus,
      conflicts: [],
    };

    expect(status.isShared).toBe(true);
    expect(status.remoteStatus.connected).toBe(true);
    expect(status.remoteStatus.ahead).toBe(2);
    expect(status.remoteStatus.behind).toBe(1);
    expect(status.pendingChanges).toBe(true);
  });
});

describe('Conflict', () => {
  it('should create content conflict', () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'local version',
        hash: 'hash1',
        author: 'user1',
        timestamp: new Date('2024-01-01'),
      },
      remoteVersion: {
        content: 'remote version',
        hash: 'hash2',
        author: 'user2',
        timestamp: new Date('2024-01-02'),
      },
      severity: 'high',
      suggestedResolution: 'manual',
      resolved: false,
    };

    expect(conflict.type).toBe('content');
    expect(conflict.severity).toBe('high');
    expect(conflict.resolved).toBe(false);
  });

  it('should support all conflict types', () => {
    const types: Array<Conflict['type']> = [
      'content',
      'delete-modify',
      'rename',
      'binary',
    ];

    types.forEach((type) => {
      const conflict: Conflict = {
        id: `conflict-${type}`,
        type,
        filePath: 'test.md',
        localVersion: {
          content: '',
          hash: '',
          author: '',
          timestamp: new Date(),
        },
        remoteVersion: {
          content: '',
          hash: '',
          author: '',
          timestamp: new Date(),
        },
        severity: 'medium',
        suggestedResolution: 'merge',
        resolved: false,
      };

      expect(conflict.type).toBe(type);
    });
  });

  it('should support all resolution strategies', () => {
    const strategies = [
      'keep-local',
      'keep-remote',
      'merge',
      'manual',
      'auto-merge',
    ] as const;

    strategies.forEach((strategy) => {
      const resolution: ConflictResolution = {
        strategy,
        resolvedBy: 'user',
        resolvedAt: new Date(),
      };

      expect(resolution.strategy).toBe(strategy);
    });
  });

  it('should create resolved conflict', () => {
    const resolution: ConflictResolution = {
      strategy: 'merge',
      resolvedContent: 'merged content',
      resolvedBy: 'user1',
      resolvedAt: new Date(),
    };

    const conflict: Conflict = {
      id: 'conflict-1',
      type: 'content',
      filePath: 'docs/wiki/page.md',
      localVersion: {
        content: 'local',
        hash: 'hash1',
        author: 'user1',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: 'remote',
        hash: 'hash2',
        author: 'user2',
        timestamp: new Date(),
      },
      severity: 'medium',
      suggestedResolution: 'merge',
      resolved: true,
      resolution,
    };

    expect(conflict.resolved).toBe(true);
    expect(conflict.resolution?.strategy).toBe('merge');
    expect(conflict.resolution?.resolvedContent).toBe('merged content');
  });
});
