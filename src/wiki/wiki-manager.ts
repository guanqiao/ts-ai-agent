import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { LLMService } from '../llm';
import { LLMConfig, DocumentFormat, ParsedFile, SymbolKind, Language } from '../types';
import { ArchitectureAnalyzer } from '../architecture';
import { GitWatcher } from '../git';
import { IncrementalUpdater, ChangeSet } from '../sync';
import {
  IWikiManager,
  WikiOptions,
  WikiContext,
  WikiDocument,
  WikiPage,
  WikiPageMetadata,
  WikiSection,
  WikiLink,
  WikiIndex,
  WikiPageIndexEntry,
  WikiCategoryIndex,
  WikiSearchEntry,
  WikiCategory,
  WikiEvent,
  WikiEventCallback,
  WikiAnswer,
  WikiDocumentMetadata,
  WikiPageVersion,
  WikiDiffResult,
  WikiAuditLog,
  AutoSyncConfig,
  SyncStatus,
  OutdatedPage,
  ReminderConfig,
  ChangeImpact,
} from './types';
import { WikiStorage } from './wiki-storage';
import { WikiKnowledgeBase } from './wiki-knowledge-base';
import { WikiHistory } from './wiki-history';
import { WikiDiff } from './wiki-diff';
import { WikiAudit } from './wiki-audit';
import { WikiAutoSync } from './wiki-auto-sync';
import { WikiSyncMonitor } from './wiki-sync-monitor';

export class WikiManager extends EventEmitter implements IWikiManager {
  private projectPath: string = '';
  private options: WikiOptions | null = null;
  private storage: WikiStorage | null = null;
  private knowledgeBase: WikiKnowledgeBase | null = null;
  private architectureAnalyzer: ArchitectureAnalyzer | null = null;
  private incrementalUpdater: IncrementalUpdater | null = null;
  private gitWatcher: GitWatcher | null = null;
  private llmService: LLMService | null = null;
  private wikiHistory: WikiHistory | null = null;
  private wikiAudit: WikiAudit | null = null;
  private autoSync: WikiAutoSync | null = null;
  private syncMonitor: WikiSyncMonitor | null = null;
  private isWatching: boolean = false;
  private currentUser?: string;

  constructor(llmConfig?: LLMConfig) {
    super();
    if (llmConfig) {
      this.llmService = new LLMService(llmConfig);
    }
  }

  async initialize(projectPath: string, options: WikiOptions, user?: string): Promise<void> {
    this.projectPath = projectPath;
    this.options = options;
    this.currentUser = user;

    this.storage = new WikiStorage(projectPath);
    this.knowledgeBase = new WikiKnowledgeBase(this.llmService || undefined);
    this.architectureAnalyzer = new ArchitectureAnalyzer();
    this.incrementalUpdater = new IncrementalUpdater(path.join(projectPath, '.wiki', 'snapshots'));
    this.wikiHistory = new WikiHistory(projectPath);
    this.wikiAudit = new WikiAudit(projectPath);
    this.autoSync = new WikiAutoSync(projectPath);
    this.syncMonitor = new WikiSyncMonitor(projectPath);

    if (this.llmService) {
      await this.llmService.initialize();
      this.knowledgeBase!.setLLMService(this.llmService);
    }
  }

  setCurrentUser(user: string): void {
    this.currentUser = user;
  }

  async generate(context: WikiContext): Promise<WikiDocument> {
    const { parsedFiles, architecture } = context;

    const archReport = architecture || (await this.architectureAnalyzer!.analyze(parsedFiles));

    const pages = await this.generatePages(parsedFiles, archReport);

    const index = this.buildIndex(pages);

    const metadata = this.buildMetadata(context, parsedFiles);

    const document: WikiDocument = {
      id: this.generateDocumentId(),
      name: metadata.projectName,
      description: `Wiki documentation for ${metadata.projectName}`,
      pages,
      index,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage!.save(document);
    await this.knowledgeBase!.index(document);

    // 保存初始版本到历史记录
    for (const page of pages) {
      await this.wikiHistory!.saveVersion(page, 'Initial version', this.currentUser);
      await this.wikiAudit!.log('page-created', {
        pageId: page.id,
        pageTitle: page.title,
        version: page.version,
        performedBy: this.currentUser,
      });
    }

    const snapshot = this.incrementalUpdater!.createSnapshot(
      parsedFiles,
      metadata.commitHash || 'initial'
    );
    await this.incrementalUpdater!.saveSnapshot(snapshot);

    this.emitEvent({
      type: 'wiki-regenerated',
      timestamp: new Date(),
      details: { pageCount: pages.length },
    });

    return document;
  }

  async update(changeSet: ChangeSet): Promise<void> {
    const existingDoc = await this.storage!.load(this.projectPath);
    if (!existingDoc) {
      throw new Error('No existing wiki found. Please generate first.');
    }

    for (const fileChange of changeSet.files) {
      const affectedPages = this.findAffectedPages(fileChange.path, existingDoc);

      for (const pageId of affectedPages) {
        const page = await this.storage!.loadPage(pageId);
        if (page) {
          const updatedContent = this.incrementalUpdater!.mergeContent(
            page.content,
            fileChange.newContent || '',
            fileChange.changeType
          );

          page.content = updatedContent;
          page.updatedAt = new Date();
          page.version++;

          await this.storage!.savePage(page);

          // 保存版本历史
          await this.wikiHistory!.saveVersion(
            page,
            `Updated due to changes in ${fileChange.path}`,
            this.currentUser
          );

          // 记录审计日志
          await this.wikiAudit!.log('page-updated', {
            pageId: page.id,
            pageTitle: page.title,
            oldVersion: page.version - 1,
            newVersion: page.version,
            performedBy: this.currentUser,
            details: { changedFile: fileChange.path },
          });

          this.emitEvent({
            type: 'page-updated',
            pageId,
            timestamp: new Date(),
          });
        }
      }
    }

    const updatedDoc = await this.storage!.load(this.projectPath);
    if (updatedDoc) {
      await this.knowledgeBase!.index(updatedDoc);
    }
  }

  async query(question: string): Promise<WikiAnswer> {
    if (!this.knowledgeBase) {
      throw new Error('Wiki not initialized');
    }

    return this.knowledgeBase.query(question);
  }

  async export(format: DocumentFormat): Promise<string> {
    const document = await this.storage!.load(this.projectPath);
    if (!document) {
      throw new Error('No wiki found');
    }

    switch (format) {
      case DocumentFormat.Markdown:
      case DocumentFormat.GitHubWiki: {
        const files = await this.storage!.exportToMarkdown(this.options!.outputDir);
        return files.join('\n');
      }

      case DocumentFormat.Confluence:
        return this.exportToConfluence(document);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  watch(callback: WikiEventCallback): void {
    if (this.isWatching) return;

    this.gitWatcher = new GitWatcher(this.projectPath, {
      debounceMs: 2000,
    });

    this.gitWatcher.start(async (event) => {
      if (event.type === 'head-change' && event.changedFiles) {
        await this.handleGitChange(event.changedFiles);
      }

      const wikiEvent: WikiEvent = {
        type: 'wiki-regenerated',
        timestamp: new Date(),
        details: { gitEvent: event },
      };

      callback(wikiEvent);
    });

    this.isWatching = true;
  }

  stopWatching(): void {
    if (this.gitWatcher) {
      this.gitWatcher.stop();
      this.gitWatcher = null;
    }
    this.isWatching = false;
  }

  async getPage(pageId: string): Promise<WikiPage | null> {
    return this.storage!.loadPage(pageId);
  }

  async listPages(): Promise<WikiPage[]> {
    return this.storage!.listPages();
  }

  async deletePage(pageId: string): Promise<void> {
    const page = await this.storage!.loadPage(pageId);
    if (page) {
      await this.storage!.deletePage(pageId);

      // 记录审计日志
      await this.wikiAudit!.log('page-deleted', {
        pageId,
        pageTitle: page.title,
        version: page.version,
        performedBy: this.currentUser,
      });

      this.emitEvent({
        type: 'page-deleted',
        pageId,
        timestamp: new Date(),
      });
    }
  }

  // ==================== 版本控制方法 ====================

  async getPageVersion(pageId: string, version: number): Promise<WikiPageVersion | null> {
    return this.wikiHistory!.getVersion(pageId, version);
  }

  async getPageHistory(pageId: string): Promise<import('./types').WikiPageHistory | null> {
    return this.wikiHistory!.getHistory(pageId);
  }

  async listPageVersions(
    pageId: string,
    limit?: number,
    offset?: number
  ): Promise<WikiPageVersion[]> {
    return this.wikiHistory!.listVersions(pageId, limit, offset);
  }

  async comparePageVersions(
    pageId: string,
    oldVersion: number,
    newVersion: number
  ): Promise<WikiDiffResult> {
    return this.wikiHistory!.compareVersions(pageId, oldVersion, newVersion);
  }

  async rollbackPage(pageId: string, targetVersion: number): Promise<WikiPage | null> {
    const rolledBackPage = await this.wikiHistory!.rollback(
      pageId,
      targetVersion,
      this.currentUser
    );

    if (rolledBackPage) {
      // 保存回滚后的页面
      await this.storage!.savePage(rolledBackPage);

      // 记录审计日志
      await this.wikiAudit!.log('page-rolled-back', {
        pageId,
        pageTitle: rolledBackPage.title,
        oldVersion: rolledBackPage.version - 1,
        newVersion: rolledBackPage.version,
        performedBy: this.currentUser,
        details: { rolledBackTo: targetVersion },
      });

      this.emitEvent({
        type: 'page-updated',
        pageId,
        timestamp: new Date(),
        details: { action: 'rollback', targetVersion },
      });
    }

    return rolledBackPage;
  }

  async generatePageDiff(
    pageId: string,
    oldVersion: number,
    newVersion: number,
    format: 'unified' | 'html' = 'unified'
  ): Promise<string> {
    const oldPageVersion = await this.wikiHistory!.getVersion(pageId, oldVersion);
    const newPageVersion = await this.wikiHistory!.getVersion(pageId, newVersion);

    if (!oldPageVersion || !newPageVersion) {
      throw new Error('Version not found');
    }

    if (format === 'html') {
      return WikiDiff.generateHtmlDiff(
        oldPageVersion.content,
        newPageVersion.content,
        oldVersion,
        newVersion
      );
    } else {
      return WikiDiff.generateUnifiedDiff(
        oldPageVersion.content,
        newPageVersion.content,
        oldVersion,
        newVersion
      );
    }
  }

  // ==================== 审计日志方法 ====================

  async getAuditLogs(query: import('./types').WikiAuditLogQuery): Promise<WikiAuditLog[]> {
    return this.wikiAudit!.query(query);
  }

  async getRecentAuditLogs(limit: number = 50): Promise<WikiAuditLog[]> {
    return this.wikiAudit!.getRecentLogs(limit);
  }

  async getPageAuditLogs(pageId: string, limit: number = 50): Promise<WikiAuditLog[]> {
    return this.wikiAudit!.getPageLogs(pageId, limit);
  }

  // ==================== 自动同步方法 ====================

  async startAutoSync(config?: Partial<AutoSyncConfig>): Promise<void> {
    const defaultConfig: AutoSyncConfig = {
      onProjectOpen: true,
      onGitChange: true,
      debounceMs: 2000,
      backgroundMode: true,
      notifyOnOutdated: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...config,
    };

    await this.autoSync!.start(defaultConfig);

    this.autoSync!.on('sync-started', (data) => {
      this.emitEvent({
        type: 'wiki-regenerated',
        timestamp: new Date(),
        details: { action: 'auto-sync-started', ...data },
      });
    });

    this.autoSync!.on('sync-completed', (data) => {
      this.emitEvent({
        type: 'wiki-regenerated',
        timestamp: new Date(),
        details: { action: 'auto-sync-completed', ...data },
      });
    });

    this.autoSync!.on('sync-error', (data) => {
      this.emitEvent({
        type: 'wiki-regenerated',
        timestamp: new Date(),
        details: { action: 'auto-sync-error', error: data.error },
      });
    });
  }

  stopAutoSync(): void {
    if (this.autoSync) {
      this.autoSync.stop();
    }
  }

  getAutoSyncStatus(): SyncStatus {
    return this.autoSync!.getStatus();
  }

  async forceSync(): Promise<void> {
    await this.autoSync!.forceSync();
  }

  isAutoSyncRunning(): boolean {
    return this.autoSync?.isRunning() || false;
  }

  // ==================== 同步监控方法 ====================

  async checkSyncStatus(): Promise<SyncStatus> {
    return this.syncMonitor!.checkSyncStatus();
  }

  async getOutdatedPages(): Promise<OutdatedPage[]> {
    return this.syncMonitor!.getOutdatedPages();
  }

  scheduleSyncReminders(config: ReminderConfig): void {
    this.syncMonitor!.scheduleReminders(config);

    this.syncMonitor!.on('reminder', (data) => {
      this.emitEvent({
        type: 'wiki-regenerated',
        timestamp: new Date(),
        details: { action: 'sync-reminder', ...data },
      });
    });
  }

  cancelSyncReminders(): void {
    this.syncMonitor!.cancelReminders();
  }

  async getChangeImpact(filePath: string): Promise<ChangeImpact> {
    return this.syncMonitor!.getChangeImpact(filePath);
  }

  async markPagesAsSynced(pageIds: string[]): Promise<void> {
    await this.syncMonitor!.markAsSynced(pageIds);
  }

  async getSyncHealth(): Promise<{
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  }> {
    return this.syncMonitor!.getSyncHealth();
  }

  private async generatePages(parsedFiles: ParsedFile[], architecture: any): Promise<WikiPage[]> {
    const pages: WikiPage[] = [];

    pages.push(this.createOverviewPage(parsedFiles, architecture));

    pages.push(this.createArchitecturePage(architecture));

    const modulePages = this.createModulePages(parsedFiles);
    pages.push(...modulePages);

    const apiPages = this.createAPIPages(parsedFiles);
    pages.push(...apiPages);

    return pages;
  }

  private createOverviewPage(parsedFiles: ParsedFile[], architecture: any): WikiPage {
    const totalSymbols = parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0);
    const classCount = parsedFiles.reduce(
      (sum, f) => sum + f.symbols.filter((s) => s.kind === SymbolKind.Class).length,
      0
    );
    const interfaceCount = parsedFiles.reduce(
      (sum, f) => sum + f.symbols.filter((s) => s.kind === SymbolKind.Interface).length,
      0
    );
    const functionCount = parsedFiles.reduce(
      (sum, f) =>
        sum +
        f.symbols.filter((s) => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method)
          .length,
      0
    );

    const content = `# Project Overview

## Summary

This project contains ${parsedFiles.length} source files with a total of ${totalSymbols} symbols.

## Architecture Pattern

The project follows the **${architecture.pattern.pattern}** architecture pattern with ${Math.round(architecture.pattern.confidence * 100)}% confidence.

## Statistics

| Metric | Count |
|--------|-------|
| Total Files | ${parsedFiles.length} |
| Total Symbols | ${totalSymbols} |
| Classes | ${classCount} |
| Interfaces | ${interfaceCount} |
| Functions/Methods | ${functionCount} |

## Key Modules

${architecture.modules
  .slice(0, 10)
  .map((m: any) => `- **${m.name}**: ${m.symbols.length} symbols`)
  .join('\n')}

## Architecture Metrics

- **Average Cohesion**: ${(architecture.metrics.averageCohesion * 100).toFixed(1)}%
- **Average Coupling**: ${architecture.metrics.averageCoupling.toFixed(1)}
- **Circular Dependencies**: ${architecture.metrics.circularDependencies}
- **Max Dependency Depth**: ${architecture.metrics.maxDependencyDepth}
`;

    return this.createPage(
      'overview',
      'Project Overview',
      content,
      'overview',
      parsedFiles.map((f) => f.path)
    );
  }

  private createArchitecturePage(architecture: any): WikiPage {
    const content = `# Architecture

## Pattern: ${architecture.pattern.pattern}

Confidence: ${Math.round(architecture.pattern.confidence * 100)}%

### Indicators

${architecture.pattern.indicators.map((i: string) => `- ${i}`).join('\n')}

## Layers

${architecture.layers
  .map(
    (layer: any) => `### ${layer.name}

${layer.description || ''}

Modules: ${layer.modules.map((m: any) => m.name).join(', ')}
`
  )
  .join('\n')}

## Recommendations

${architecture.recommendations.map((r: string) => `- ${r}`).join('\n')}
`;

    return this.createPage('architecture', 'Architecture', content, 'architecture', []);
  }

  private createModulePages(parsedFiles: ParsedFile[]): WikiPage[] {
    const moduleMap = new Map<string, ParsedFile[]>();

    for (const file of parsedFiles) {
      const moduleName = path.dirname(file.path).split(path.sep).pop() || 'root';
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }
      moduleMap.get(moduleName)!.push(file);
    }

    const pages: WikiPage[] = [];

    for (const [moduleName, files] of moduleMap) {
      const content = this.generateModuleContent(moduleName, files);
      pages.push(
        this.createPage(
          `module-${moduleName}`,
          `Module: ${moduleName}`,
          content,
          'module',
          files.map((f) => f.path)
        )
      );
    }

    return pages;
  }

  private generateModuleContent(moduleName: string, files: ParsedFile[]): string {
    const symbols = files.flatMap((f) => f.symbols);

    const classes = symbols.filter((s) => s.kind === SymbolKind.Class);
    const interfaces = symbols.filter((s) => s.kind === SymbolKind.Interface);
    const functions = symbols.filter(
      (s) => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method
    );

    let content = `# Module: ${moduleName}

## Files

${files.map((f) => `- ${path.basename(f.path)}`).join('\n')}

## Statistics

- Classes: ${classes.length}
- Interfaces: ${interfaces.length}
- Functions: ${functions.length}

`;

    if (classes.length > 0) {
      content += `## Classes

${classes
  .map(
    (c) => `### ${c.name}

${c.description || 'No description available.'}

${
  c.members && c.members.length > 0 ? `**Members:** ${c.members.map((m) => m.name).join(', ')}` : ''
}
`
  )
  .join('\n')}

`;
    }

    if (interfaces.length > 0) {
      content += `## Interfaces

${interfaces
  .map(
    (i) => `### ${i.name}

${i.description || 'No description available.'}
`
  )
  .join('\n')}

`;
    }

    return content;
  }

  private createAPIPages(parsedFiles: ParsedFile[]): WikiPage[] {
    const pages: WikiPage[] = [];

    const allSymbols = parsedFiles.flatMap((f) =>
      f.symbols.map((s) => ({ ...s, filePath: f.path }))
    );

    const publicAPIs = allSymbols.filter(
      (s) =>
        (s.kind === SymbolKind.Class ||
          s.kind === SymbolKind.Interface ||
          s.kind === SymbolKind.Function) &&
        !s.modifiers?.includes('private')
    );

    if (publicAPIs.length > 0) {
      const content = this.generateAPIContent(publicAPIs);
      pages.push(
        this.createPage('api-reference', 'API Reference', content, 'api', [
          ...new Set(publicAPIs.map((s) => s.filePath)),
        ])
      );
    }

    return pages;
  }

  private generateAPIContent(symbols: any[]): string {
    let content = `# API Reference

`;

    const classes = symbols.filter((s) => s.kind === SymbolKind.Class);
    const interfaces = symbols.filter((s) => s.kind === SymbolKind.Interface);
    const functions = symbols.filter((s) => s.kind === SymbolKind.Function);

    if (classes.length > 0) {
      content += `## Classes

${classes
  .map(
    (c) => `### ${c.name}

${c.description || ''}

${
  c.signature
    ? `\`\`\`typescript
${c.signature}
\`\`\`
`
    : ''
}

${
  c.members && c.members.length > 0
    ? `#### Members

| Name | Kind | Type | Description |
|------|------|------|-------------|
${c.members
  .map((m: any) => `| ${m.name} | ${m.kind} | ${m.type || '-'} | ${m.description || '-'} |`)
  .join('\n')}
`
    : ''
}
`
  )
  .join('\n')}

`;
    }

    if (interfaces.length > 0) {
      content += `## Interfaces

${interfaces
  .map(
    (i) => `### ${i.name}

${i.description || ''}

${
  i.members && i.members.length > 0
    ? `#### Properties

| Name | Type | Description |
|------|------|-------------|
${i.members
  .map((m: any) => `| ${m.name} | ${m.type || '-'} | ${m.description || '-'} |`)
  .join('\n')}
`
    : ''
}
`
  )
  .join('\n')}

`;
    }

    if (functions.length > 0) {
      content += `## Functions

${functions
  .map(
    (f) => `### ${f.name}

${f.description || ''}

${
  f.signature
    ? `\`\`\`typescript
${f.signature}
\`\`\`
`
    : ''
}

${
  f.parameters && f.parameters.length > 0
    ? `#### Parameters

| Name | Type | Optional | Description |
|------|------|----------|-------------|
${f.parameters
  .map(
    (p: any) => `| ${p.name} | ${p.type} | ${p.optional ? 'Yes' : 'No'} | ${p.description || '-'} |`
  )
  .join('\n')}
`
    : ''
}

${f.returnType ? `**Returns:** \`${f.returnType}\`` : ''}
`
  )
  .join('\n')}

`;
    }

    return content;
  }

  private createPage(
    id: string,
    title: string,
    content: string,
    category: WikiCategory,
    sourceFiles: string[]
  ): WikiPage {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const sections = this.extractSections(content);
    const links = this.extractLinks(content);

    const metadata: WikiPageMetadata = {
      tags: this.extractTags(content),
      category,
      sourceFiles,
      language: this.options?.language || Language.TypeScript,
    };

    return {
      id,
      title,
      slug,
      content,
      format: this.options?.format || DocumentFormat.Markdown,
      metadata,
      sections,
      links,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
  }

  private extractSections(content: string): WikiSection[] {
    const sections: WikiSection[] = [];
    const pattern = /^(#{1,6}) (.+)$/gm;
    let match;
    let order = 0;

    while ((match = pattern.exec(content)) !== null) {
      sections.push({
        id: `section-${order}`,
        title: match[2],
        content: '',
        level: match[1].length,
        order: order++,
      });
    }

    return sections;
  }

  private extractLinks(content: string): WikiLink[] {
    const links: WikiLink[] = [];
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const target = match[2];
      links.push({
        text: match[1],
        target,
        type: target.startsWith('http') ? 'external' : 'internal',
      });
    }

    return links;
  }

  private extractTags(content: string): string[] {
    const tags: Set<string> = new Set();

    const tagPattern = /`(\w+)`/g;
    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      if (match[1].length > 2) {
        tags.add(match[1]);
      }
    }

    return Array.from(tags).slice(0, 10);
  }

  private buildIndex(pages: WikiPage[]): WikiIndex {
    const pageIndex: WikiPageIndexEntry[] = pages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      category: page.metadata.category,
      tags: page.metadata.tags,
      wordCount: page.content.split(/\s+/).length,
    }));

    const categories: WikiCategoryIndex[] = [];
    const categoryMap = new Map<WikiCategory, string[]>();

    for (const page of pages) {
      if (!categoryMap.has(page.metadata.category)) {
        categoryMap.set(page.metadata.category, []);
      }
      categoryMap.get(page.metadata.category)!.push(page.id);
    }

    for (const [category, pageIds] of categoryMap) {
      categories.push({
        category,
        pages: pageIds,
      });
    }

    const searchEntries: WikiSearchEntry[] = pages.map((page) => ({
      pageId: page.id,
      keywords: [...page.metadata.tags, ...page.title.split(/\s+/)],
      summary: page.content.slice(0, 200),
    }));

    return {
      pages: pageIndex,
      categories,
      searchIndex: searchEntries,
    };
  }

  private buildMetadata(_context: WikiContext, parsedFiles: ParsedFile[]): WikiDocumentMetadata {
    return {
      projectName: path.basename(this.projectPath),
      generator: 'tsd-generator',
      generatorVersion: '1.0.0',
      totalFiles: parsedFiles.length,
      totalSymbols: parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0),
    };
  }

  private generateDocumentId(): string {
    const hash = crypto
      .createHash('md5')
      .update(this.projectPath + Date.now())
      .digest('hex')
      .substring(0, 8);
    return `wiki-${hash}`;
  }

  private findAffectedPages(filePath: string, document: WikiDocument): string[] {
    const affected: string[] = [];

    for (const page of document.pages) {
      if (page.metadata.sourceFiles.includes(filePath)) {
        affected.push(page.id);
      }
    }

    return affected;
  }

  private async handleGitChange(changedFiles: string[]): Promise<void> {
    this.emitEvent({
      type: 'wiki-regenerated',
      timestamp: new Date(),
      details: { changedFiles },
    });
  }

  private exportToConfluence(document: WikiDocument): string {
    let content = `<h1>${document.name}</h1>\n\n`;

    for (const page of document.pages) {
      content += this.convertMarkdownToConfluence(page.content);
      content += '\n\n---\n\n';
    }

    return content;
  }

  private convertMarkdownToConfluence(markdown: string): string {
    let confluence = markdown;

    confluence = confluence.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    confluence = confluence.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    confluence = confluence.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    confluence = confluence.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>'
    );

    confluence = confluence.replace(/`([^`]+)`/g, '<code>$1</code>');

    confluence = confluence.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    confluence = confluence.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    confluence = confluence.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return confluence;
  }

  private emitEvent(event: WikiEvent): void {
    this.emit('event', event);
  }
}
