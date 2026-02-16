import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  IWikiSharingService,
  WikiSharingConfig,
  ShareResult,
  SyncResult,
  ShareStatus,
  Conflict,
  ConflictResolution,
  ShareError,
  ShareSyncError,
  RemoteStatus,
  ShareableContent,
  ShareMetadata,
  ShareManifest,
  ManifestEntry,
  DEFAULT_SHARING_CONFIG,
} from './types';
import { WikiPage, WikiDocument } from '../types';

export class WikiSharingService extends EventEmitter implements IWikiSharingService {
  private projectPath: string;
  private config: WikiSharingConfig | null = null;
  private wikiDocument: WikiDocument | null = null;
  private shareManifest: ShareManifest | null = null;
  private conflicts: Map<string, Conflict> = new Map();

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
  }

  async initialize(config: WikiSharingConfig): Promise<void> {
    this.config = { ...DEFAULT_SHARING_CONFIG, ...config };
    
    const shareDir = this.getShareDir();
    if (!fs.existsSync(shareDir)) {
      fs.mkdirSync(shareDir, { recursive: true });
    }

    await this.loadManifest();
    
    this.emit('initialized', { config: this.config });
  }

  setWikiDocument(document: WikiDocument): void {
    this.wikiDocument = document;
  }

  async share(): Promise<ShareResult> {
    if (!this.isConfigured()) {
      return this.createShareResult(false, 'Sharing not configured', 0, []);
    }

    if (!this.wikiDocument) {
      return this.createShareResult(false, 'No wiki document to share', 0, []);
    }

    const errors: ShareError[] = [];
    let filesShared = 0;

    try {
      const content = await this.prepareShareableContent();
      
      await this.writeShareableContent(content, errors);
      filesShared = content.manifest.files.length;

      await this.updateManifest(content.manifest);

      if (this.config!.autoCommit && this.config!.shareToGit) {
        await this.commitToGit();
      }

      this.emit('shared', { filesShared, timestamp: new Date() });

      return this.createShareResult(
        true,
        `Successfully shared ${filesShared} files`,
        filesShared,
        errors
      );
    } catch (error) {
      const shareError: ShareError = {
        code: 'SHARE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      errors.push(shareError);
      
      return this.createShareResult(false, shareError.message, filesShared, errors);
    }
  }

  async sync(): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return this.createSyncResult(false, 'Sharing not configured', 'both', 0, [], []);
    }

    const conflicts = await this.detectConflicts();
    if (conflicts.length > 0) {
      conflicts.forEach(c => this.conflicts.set(c.id, c));
      return this.createSyncResult(
        false,
        `Sync blocked by ${conflicts.length} conflicts`,
        'both',
        0,
        conflicts,
        [{ code: 'CONFLICTS_DETECTED', message: 'Please resolve conflicts first', retryable: false }]
      );
    }

    const errors: ShareSyncError[] = [];
    let filesSynced = 0;

    try {
      if (this.config!.syncWithRemote) {
        const pullResult = await this.pullFromRemote();
        filesSynced += pullResult.filesSynced;
        errors.push(...pullResult.errors);
      }

      const pushResult = await this.pushToRemote();
      filesSynced += pushResult.filesSynced;
      errors.push(...pushResult.errors);

      this.emit('synced', { filesSynced, timestamp: new Date() });

      return this.createSyncResult(
        errors.length === 0,
        `Synced ${filesSynced} files`,
        'both',
        filesSynced,
        [],
        errors
      );
    } catch (error) {
      const syncError: ShareSyncError = {
        code: 'SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      };
      errors.push(syncError);
      
      return this.createSyncResult(false, syncError.message, 'both', filesSynced, [], errors);
    }
  }

  async getStatus(): Promise<ShareStatus> {
    const shareDir = this.getShareDir();
    const isShared = fs.existsSync(shareDir);
    
    const manifest = await this.loadManifest();
    const remoteStatus = await this.getRemoteStatus();
    const conflicts = Array.from(this.conflicts.values());

    return {
      isShared,
      sharePath: this.config?.sharePath || '',
      lastSharedAt: manifest ? new Date(manifest.files[0]?.lastModified) : null,
      lastSyncedAt: null,
      pendingChanges: await this.hasPendingChanges(),
      remoteStatus,
      conflicts,
    };
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolution = resolution;
    conflict.resolved = true;

    await this.applyConflictResolution(conflict);
    
    this.conflicts.delete(conflictId);
    this.emit('conflict-resolved', { conflictId, resolution });
  }

  async resolveConflicts(resolutions: Map<string, ConflictResolution>): Promise<void> {
    for (const [conflictId, resolution] of resolutions) {
      await this.resolveConflict(conflictId, resolution);
    }
  }

  async getConflicts(): Promise<Conflict[]> {
    return Array.from(this.conflicts.values());
  }

  async pullFromRemote(): Promise<SyncResult> {
    const errors: ShareSyncError[] = [];
    let filesSynced = 0;

    try {
      const gitResult = await this.executeGitCommand(['pull', '--no-edit']);
      
      if (gitResult.success) {
        filesSynced = await this.countChangedFiles();
        await this.loadManifest();
      } else {
        errors.push({
          code: 'GIT_PULL_FAILED',
          message: gitResult.output,
          retryable: true,
        });
      }

      return this.createSyncResult(
        errors.length === 0,
        errors.length === 0 ? 'Pull successful' : 'Pull failed',
        'pull',
        filesSynced,
        [],
        errors
      );
    } catch (error) {
      return this.createSyncResult(
        false,
        error instanceof Error ? error.message : 'Pull failed',
        'pull',
        0,
        [],
        [{ code: 'PULL_ERROR', message: String(error), retryable: true }]
      );
    }
  }

  async pushToRemote(): Promise<SyncResult> {
    const errors: ShareSyncError[] = [];
    let filesSynced = 0;

    try {
      if (this.config!.autoCommit) {
        await this.commitToGit();
      }

      const gitResult = await this.executeGitCommand(['push']);
      
      if (gitResult.success) {
        filesSynced = await this.countChangedFiles();
      } else {
        errors.push({
          code: 'GIT_PUSH_FAILED',
          message: gitResult.output,
          retryable: true,
        });
      }

      return this.createSyncResult(
        errors.length === 0,
        errors.length === 0 ? 'Push successful' : 'Push failed',
        'push',
        filesSynced,
        [],
        errors
      );
    } catch (error) {
      return this.createSyncResult(
        false,
        error instanceof Error ? error.message : 'Push failed',
        'push',
        0,
        [],
        [{ code: 'PUSH_ERROR', message: String(error), retryable: true }]
      );
    }
  }

  async detectConflicts(): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    if (!this.config?.syncWithRemote) {
      return conflicts;
    }

    try {
      const statusResult = await this.executeGitCommand(['status', '--porcelain']);
      
      if (statusResult.output.includes('UU') || statusResult.output.includes('AA')) {
        const lines = statusResult.output.split('\n').filter(line => 
          line.includes('UU') || line.includes('AA')
        );

        for (const line of lines) {
          const filePath = line.substring(3).trim();
          const conflict = await this.createConflictFromFile(filePath);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    } catch {
      // Git not available or not a git repo
    }

    return conflicts;
  }

  isConfigured(): boolean {
    return this.config !== null && this.config.enabled;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  private getShareDir(): string {
    return path.join(this.projectPath, this.config?.sharePath || 'docs/wiki');
  }

  private async prepareShareableContent(): Promise<ShareableContent> {
    if (!this.wikiDocument) {
      throw new Error('No wiki document available');
    }

    const metadata: ShareMetadata = {
      projectName: this.wikiDocument.name,
      version: `v${this.wikiDocument.metadata.generatorVersion}`,
      generatedAt: new Date(),
      generator: this.wikiDocument.metadata.generator,
      totalFiles: this.wikiDocument.metadata.totalFiles,
      totalPages: this.wikiDocument.pages.length,
    };

    const manifest = await this.createManifest(this.wikiDocument.pages);

    return {
      pages: this.wikiDocument.pages,
      metadata,
      manifest,
    };
  }

  private async createManifest(pages: WikiPage[]): Promise<ShareManifest> {
    const entries: ManifestEntry[] = [];

    for (const page of pages) {
      const content = this.serializePage(page);
      const hash = this.computeHash(content);
      
      entries.push({
        path: `${page.slug}.md`,
        type: 'page',
        hash,
        size: content.length,
        lastModified: page.updatedAt,
      });
    }

    entries.push({
      path: 'index.json',
      type: 'index',
      hash: this.computeHash(JSON.stringify(this.wikiDocument?.index || {})),
      size: 0,
      lastModified: new Date(),
    });

    entries.push({
      path: 'metadata.json',
      type: 'metadata',
      hash: this.computeHash(JSON.stringify(this.wikiDocument?.metadata || {})),
      size: 0,
      lastModified: new Date(),
    });

    const checksums: Record<string, string> = {};
    for (const entry of entries) {
      checksums[entry.path] = entry.hash;
    }

    return {
      version: 1,
      files: entries,
      checksums,
    };
  }

  private async writeShareableContent(
    content: ShareableContent,
    errors: ShareError[]
  ): Promise<void> {
    const shareDir = this.getShareDir();

    if (!fs.existsSync(shareDir)) {
      fs.mkdirSync(shareDir, { recursive: true });
    }

    for (const page of content.pages) {
      try {
        const filePath = path.join(shareDir, `${page.slug}.md`);
        const pageContent = this.serializePage(page);
        fs.writeFileSync(filePath, pageContent, 'utf-8');
      } catch (error) {
        errors.push({
          code: 'WRITE_PAGE_FAILED',
          message: `Failed to write page ${page.slug}`,
          filePath: page.slug,
          details: { error: String(error) },
        });
      }
    }

    try {
      const indexPath = path.join(shareDir, 'index.json');
      fs.writeFileSync(indexPath, JSON.stringify(this.wikiDocument?.index, null, 2), 'utf-8');
    } catch (error) {
      errors.push({
        code: 'WRITE_INDEX_FAILED',
        message: 'Failed to write index file',
        details: { error: String(error) },
      });
    }

    try {
      const metadataPath = path.join(shareDir, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(content.metadata, null, 2), 'utf-8');
    } catch (error) {
      errors.push({
        code: 'WRITE_METADATA_FAILED',
        message: 'Failed to write metadata file',
        details: { error: String(error) },
      });
    }
  }

  private serializePage(page: WikiPage): string {
    let content = `# ${page.title}\n\n`;
    content += `> Category: ${page.metadata.category} | Version: ${page.version} | Updated: ${page.updatedAt.toISOString()}\n\n`;
    
    if (page.metadata.tags.length > 0) {
      content += `**Tags:** ${page.metadata.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
    }

    content += page.content;

    return content;
  }

  private async updateManifest(manifest: ShareManifest): Promise<void> {
    this.shareManifest = manifest;
    
    const manifestPath = path.join(this.getShareDir(), 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  private async loadManifest(): Promise<ShareManifest | null> {
    const manifestPath = path.join(this.getShareDir(), 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        this.shareManifest = JSON.parse(content);
        return this.shareManifest;
      } catch {
        return null;
      }
    }
    
    return null;
  }

  private async commitToGit(): Promise<void> {
    const shareDir = this.getShareDir();
    const relativePath = path.relative(this.projectPath, shareDir);

    await this.executeGitCommand(['add', relativePath]);
    
    const message = this.config!.commitMessageTemplate
      .replace('{date}', new Date().toISOString().split('T')[0])
      .replace('{count}', String(this.wikiDocument?.pages.length || 0));

    await this.executeGitCommand(['commit', '-m', message, '--no-verify']);
  }

  private async executeGitCommand(args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const git = spawn('git', args, { cwd: this.projectPath });
      
      let output = '';
      git.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      git.stderr.on('data', (data: Buffer) => { output += data.toString(); });
      
      git.on('close', (code: number) => {
        resolve({ success: code === 0, output });
      });
      
      git.on('error', () => {
        resolve({ success: false, output: 'Git command failed' });
      });
    });
  }

  private async getRemoteStatus(): Promise<RemoteStatus> {
    try {
      const branchResult = await this.executeGitCommand(['branch', '--show-current']);
      const branch = branchResult.output.trim() || 'main';

      await this.executeGitCommand(['fetch']);

      const aheadResult = await this.executeGitCommand([
        'rev-list', '--count', `origin/${branch}..HEAD`
      ]);
      const behindResult = await this.executeGitCommand([
        'rev-list', '--count', `HEAD..origin/${branch}`
      ]);

      return {
        connected: true,
        branch,
        ahead: parseInt(aheadResult.output.trim()) || 0,
        behind: parseInt(behindResult.output.trim()) || 0,
        lastFetchAt: new Date(),
      };
    } catch {
      return {
        connected: false,
        branch: '',
        ahead: 0,
        behind: 0,
        lastFetchAt: null,
      };
    }
  }

  private async hasPendingChanges(): Promise<boolean> {
    if (!this.shareManifest || !this.wikiDocument) {
      return false;
    }

    for (const page of this.wikiDocument.pages) {
      const entry = this.shareManifest.files.find(f => f.path === `${page.slug}.md`);
      if (!entry) return true;
      
      const currentHash = this.computeHash(this.serializePage(page));
      if (entry.hash !== currentHash) return true;
    }

    return false;
  }

  private async countChangedFiles(): Promise<number> {
    try {
      const result = await this.executeGitCommand(['diff', '--name-only', 'HEAD~1']);
      return result.output.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  private async createConflictFromFile(filePath: string): Promise<Conflict | null> {
    const fullPath = path.join(this.projectPath, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    
    return {
      id: this.computeHash(filePath),
      type: 'content',
      filePath,
      localVersion: {
        content: this.extractLocalVersion(content),
        hash: '',
        author: '',
        timestamp: new Date(),
      },
      remoteVersion: {
        content: this.extractRemoteVersion(content),
        hash: '',
        author: '',
        timestamp: new Date(),
      },
      severity: 'medium',
      suggestedResolution: 'merge',
      resolved: false,
    };
  }

  private extractLocalVersion(conflictContent: string): string {
    const match = conflictContent.match(/<<<<<<< HEAD\n([\s\S]*?)=======/);
    return match ? match[1].trim() : '';
  }

  private extractRemoteVersion(conflictContent: string): string {
    const match = conflictContent.match(/=======\n([\s\S]*?)>>>>>>>/);
    return match ? match[1].trim() : '';
  }

  private async applyConflictResolution(conflict: Conflict): Promise<void> {
    if (!conflict.resolution) return;

    const fullPath = path.join(this.projectPath, conflict.filePath);
    
    switch (conflict.resolution.strategy) {
      case 'keep-local':
        fs.writeFileSync(fullPath, conflict.localVersion.content, 'utf-8');
        break;
      case 'keep-remote':
        fs.writeFileSync(fullPath, conflict.remoteVersion.content, 'utf-8');
        break;
      case 'manual':
      case 'merge':
        if (conflict.resolution.resolvedContent) {
          fs.writeFileSync(fullPath, conflict.resolution.resolvedContent, 'utf-8');
        }
        break;
    }

    await this.executeGitCommand(['add', conflict.filePath]);
  }

  private computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  private createShareResult(
    success: boolean,
    message: string,
    filesShared: number,
    errors: ShareError[]
  ): ShareResult {
    return {
      success,
      message,
      filesShared,
      timestamp: new Date(),
      errors,
    };
  }

  private createSyncResult(
    success: boolean,
    message: string,
    direction: 'push' | 'pull' | 'both',
    filesSynced: number,
    conflicts: Conflict[],
    errors: ShareSyncError[]
  ): SyncResult {
    return {
      success,
      message,
      direction,
      filesSynced,
      conflicts,
      timestamp: new Date(),
      errors,
    };
  }
}
