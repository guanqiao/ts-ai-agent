import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  ImpactItem,
  ImpactChain,
  ImpactChainItem,
  EnhancedChangeImpact,
  IChangeImpactAnalyzer,
  RiskLevel,
} from './types';
import { WikiPage } from '../types';

export class ChangeImpactAnalyzer implements IChangeImpactAnalyzer {
  private projectPath: string;
  private pageCache: Map<string, WikiPage>;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.pageCache = new Map();
    this.loadPageCache();
  }

  async analyzeDirectImpact(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed'
  ): Promise<ImpactItem[]> {
    const impacts: ImpactItem[] = [];
    const fileName = path.basename(filePath);

    for (const [pageId, page] of this.pageCache) {
      const isAffected = this.isFileReferencedInPage(filePath, page);

      if (isAffected) {
        const affectedSections = this.findAffectedSections(filePath, page);
        const severity = this.determineSeverity(changeType, affectedSections.length);

        impacts.push({
          id: this.generateImpactId(),
          type: 'direct',
          targetId: pageId,
          targetType: 'page',
          targetName: page.title,
          description: `Page "${page.title}" directly references ${fileName}`,
          severity,
          confidence: 0.9,
          affectedSections,
          metadata: {
            changeType,
            breakingChange: this.isBreakingChange(filePath, changeType),
            deprecation: false,
          },
        });
      }
    }

    const symbolImpacts = await this.analyzeSymbolImpacts(filePath, changeType);
    impacts.push(...symbolImpacts);

    return impacts;
  }

  async analyzeIndirectImpact(directImpacts: ImpactItem[]): Promise<ImpactItem[]> {
    const indirectImpacts: ImpactItem[] = [];
    const processedIds = new Set<string>();

    for (const directImpact of directImpacts) {
      if (directImpact.targetType !== 'page') continue;

      const page = this.pageCache.get(directImpact.targetId);
      if (!page) continue;

      const linkedPages = this.findLinkedPages(page);

      for (const linkedPage of linkedPages) {
        if (processedIds.has(linkedPage.id)) continue;
        processedIds.add(linkedPage.id);

        const isAlreadyDirect = directImpacts.some(
          (i) => i.targetId === linkedPage.id && i.type === 'direct'
        );

        if (!isAlreadyDirect) {
          indirectImpacts.push({
            id: this.generateImpactId(),
            type: 'indirect',
            targetId: linkedPage.id,
            targetType: 'page',
            targetName: linkedPage.title,
            description: `Page "${linkedPage.title}" is linked from affected page "${page.title}"`,
            severity: this.downgradeSeverity(directImpact.severity),
            confidence: 0.7,
            affectedSections: [],
            metadata: {
              changeType: directImpact.metadata.changeType,
              breakingChange: false,
              deprecation: false,
            },
          });
        }
      }
    }

    const moduleImpacts = this.analyzeModuleImpacts(directImpacts);
    indirectImpacts.push(...moduleImpacts);

    return indirectImpacts;
  }

  async traceImpactChain(sourceFile: string, maxDepth: number = 3): Promise<ImpactChain[]> {
    const chains: ImpactChain[] = [];
    const directImpacts = await this.analyzeDirectImpact(sourceFile, 'modified');

    for (const directImpact of directImpacts) {
      const chain = await this.buildImpactChain(directImpact, maxDepth);
      if (chain) {
        chains.push(chain);
      }
    }

    return chains;
  }

  async analyzeFullImpact(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed',
    changeDescription?: string
  ): Promise<EnhancedChangeImpact> {
    const startTime = Date.now();

    const directImpacts = await this.analyzeDirectImpact(filePath, changeType);
    const indirectImpacts = await this.analyzeIndirectImpact(directImpacts);
    const impactChains = await this.traceImpactChain(filePath);

    const affectedTests = this.findAffectedTests(filePath, directImpacts);
    const affectedDocumentation = this.findAffectedDocumentation(directImpacts, indirectImpacts);

    const impact: EnhancedChangeImpact = {
      id: this.generateImpactId(),
      sourceFile: filePath,
      changeType,
      changeDescription,
      directImpacts,
      indirectImpacts,
      impactChains,
      riskAssessment: {
        overallRisk: this.calculateOverallRisk(directImpacts, indirectImpacts),
        riskScore: 0,
        riskFactors: [],
        mitigationStrategies: [],
        confidence: 0.8,
        summary: '',
      },
      suggestedActions: [],
      affectedTests,
      affectedDocumentation,
      metadata: {
        analysisTime: Date.now() - startTime,
        confidence: this.calculateConfidence(directImpacts, indirectImpacts),
      },
      createdAt: new Date(),
    };

    return impact;
  }

  private loadPageCache(): void {
    const wikiDir = path.join(this.projectPath, '.wiki', 'pages');
    if (!fs.existsSync(wikiDir)) return;

    const pageFiles = fs.readdirSync(wikiDir).filter((f) => f.endsWith('.json'));

    for (const pageFile of pageFiles) {
      try {
        const content = fs.readFileSync(path.join(wikiDir, pageFile), 'utf-8');
        const page: WikiPage = JSON.parse(content);
        this.pageCache.set(page.id, page);
      } catch {
        // Skip invalid files
      }
    }
  }

  private isFileReferencedInPage(filePath: string, page: WikiPage): boolean {
    const relativePath = path.relative(this.projectPath, filePath);

    if (
      page.metadata.sourceFiles.includes(filePath) ||
      page.metadata.sourceFiles.includes(relativePath)
    ) {
      return true;
    }

    const fileName = path.basename(filePath);
    const moduleName = path.dirname(filePath).split(path.sep).pop() || '';

    if (page.content.includes(fileName) || page.content.includes(moduleName)) {
      return true;
    }

    for (const tag of page.metadata.tags) {
      if (
        fileName.toLowerCase().includes(tag.toLowerCase()) ||
        moduleName.toLowerCase().includes(tag.toLowerCase())
      ) {
        return true;
      }
    }

    return false;
  }

  private findAffectedSections(filePath: string, page: WikiPage): string[] {
    const affectedSections: string[] = [];
    const fileName = path.basename(filePath);

    for (const section of page.sections) {
      if (section.content?.toLowerCase().includes(fileName.toLowerCase())) {
        affectedSections.push(section.title);
      }
    }

    return affectedSections;
  }

  private determineSeverity(changeType: string, affectedSectionCount: number): RiskLevel {
    if (changeType === 'removed') return 'high';
    if (changeType === 'modified' && affectedSectionCount > 3) return 'high';
    if (changeType === 'modified' && affectedSectionCount > 1) return 'medium';
    return 'low';
  }

  private isBreakingChange(filePath: string, changeType: string): boolean {
    if (changeType === 'removed') return true;

    const breakingPatterns = [/api/i, /interface/i, /types?\.ts$/i, /index\.ts$/i];

    return breakingPatterns.some((p) => p.test(filePath));
  }

  private async analyzeSymbolImpacts(
    filePath: string,
    changeType: 'added' | 'modified' | 'removed'
  ): Promise<ImpactItem[]> {
    const impacts: ImpactItem[] = [];
    const fileName = path.basename(filePath, path.extname(filePath));

    for (const [pageId, page] of this.pageCache) {
      if (page.metadata.category !== 'api' && page.metadata.category !== 'reference') continue;

      const symbolPattern = new RegExp(`\\b${fileName}\\b`, 'gi');
      const matches = page.content.match(symbolPattern);

      if (matches && matches.length > 0) {
        impacts.push({
          id: this.generateImpactId(),
          type: 'direct',
          targetId: pageId,
          targetType: 'page',
          targetName: page.title,
          description: `API page "${page.title}" references symbol from ${path.basename(filePath)}`,
          severity: changeType === 'removed' ? 'high' : 'medium',
          confidence: 0.85,
          affectedSections: [],
          metadata: {
            symbolName: fileName,
            changeType,
            breakingChange: changeType === 'removed',
            deprecation: false,
          },
        });
      }
    }

    return impacts;
  }

  private findLinkedPages(page: WikiPage): WikiPage[] {
    const linkedPages: WikiPage[] = [];

    for (const link of page.links) {
      if (link.type !== 'internal') continue;

      for (const [, p] of this.pageCache) {
        if (p.slug === link.target || p.id === link.target) {
          linkedPages.push(p);
          break;
        }
      }
    }

    return linkedPages;
  }

  private downgradeSeverity(severity: RiskLevel): RiskLevel {
    switch (severity) {
      case 'critical':
        return 'high';
      case 'high':
        return 'medium';
      case 'medium':
        return 'low';
      case 'low':
        return 'low';
    }
  }

  private analyzeModuleImpacts(directImpacts: ImpactItem[]): ImpactItem[] {
    const moduleImpacts: ImpactItem[] = [];
    const affectedModules = new Map<string, number>();

    for (const impact of directImpacts) {
      const page = this.pageCache.get(impact.targetId);
      if (!page) continue;

      for (const sourceFile of page.metadata.sourceFiles) {
        const moduleName = path.dirname(sourceFile).split(path.sep).pop() || '';
        if (moduleName) {
          affectedModules.set(moduleName, (affectedModules.get(moduleName) || 0) + 1);
        }
      }
    }

    for (const [moduleName, count] of affectedModules) {
      if (count >= 2) {
        moduleImpacts.push({
          id: this.generateImpactId(),
          type: 'indirect',
          targetId: `module-${moduleName}`,
          targetType: 'module',
          targetName: moduleName,
          description: `Module "${moduleName}" has ${count} affected pages`,
          severity: count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low',
          confidence: 0.75,
          affectedSections: [],
          metadata: {
            changeType: 'modified',
            breakingChange: false,
            deprecation: false,
          },
        });
      }
    }

    return moduleImpacts;
  }

  private async buildImpactChain(
    directImpact: ImpactItem,
    maxDepth: number
  ): Promise<ImpactChain | null> {
    const items: ImpactChainItem[] = [];
    const visited = new Set<string>();

    const rootItem: ImpactChainItem = {
      item: directImpact,
      depth: 0,
      children: [],
    };
    items.push(rootItem);
    visited.add(directImpact.targetId);

    await this.expandChainItem(rootItem, items, visited, maxDepth);

    const totalRisk = this.calculateChainRisk(items);
    const isCritical = items.some(
      (i) => i.item.severity === 'critical' || i.item.severity === 'high'
    );

    return {
      id: this.generateImpactId(),
      sourceId: directImpact.id,
      items,
      totalDepth: Math.max(...items.map((i) => i.depth)),
      totalRisk,
      criticalPath: isCritical,
    };
  }

  private async expandChainItem(
    chainItem: ImpactChainItem,
    allItems: ImpactChainItem[],
    visited: Set<string>,
    maxDepth: number
  ): Promise<void> {
    if (chainItem.depth >= maxDepth) return;

    const page = this.pageCache.get(chainItem.item.targetId);
    if (!page) return;

    const linkedPages = this.findLinkedPages(page);

    for (const linkedPage of linkedPages) {
      if (visited.has(linkedPage.id)) continue;
      visited.add(linkedPage.id);

      const newItem: ImpactItem = {
        id: this.generateImpactId(),
        type: 'indirect',
        targetId: linkedPage.id,
        targetType: 'page',
        targetName: linkedPage.title,
        description: `Indirectly affected through ${page.title}`,
        severity: this.downgradeSeverity(chainItem.item.severity),
        confidence: chainItem.item.confidence * 0.8,
        affectedSections: [],
        metadata: {
          changeType: chainItem.item.metadata.changeType,
          breakingChange: false,
          deprecation: false,
        },
      };

      const newChainItem: ImpactChainItem = {
        item: newItem,
        depth: chainItem.depth + 1,
        parentItemId: chainItem.item.id,
        children: [],
      };

      chainItem.children.push(newItem.id);
      allItems.push(newChainItem);

      await this.expandChainItem(newChainItem, allItems, visited, maxDepth);
    }
  }

  private calculateChainRisk(items: ImpactChainItem[]): number {
    let totalRisk = 0;

    for (const item of items) {
      const severityScore = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      }[item.item.severity];

      const depthPenalty = item.depth * 0.1;
      totalRisk += severityScore * (1 - depthPenalty) * item.item.confidence;
    }

    return Math.min(100, totalRisk * 10);
  }

  private findAffectedTests(filePath: string, _directImpacts: ImpactItem[]): string[] {
    const tests: string[] = [];
    const fileName = path.basename(filePath, path.extname(filePath));

    const testPatterns = [
      new RegExp(`${fileName}\\.test\\.ts$`, 'i'),
      new RegExp(`${fileName}\\.spec\\.ts$`, 'i'),
      new RegExp(`${fileName}\\.test\\.js$`, 'i'),
      new RegExp(`${fileName}\\.spec\\.js$`, 'i'),
    ];

    const srcDir = path.join(this.projectPath, 'src');
    if (!fs.existsSync(srcDir)) return tests;

    const findTests = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          findTests(fullPath);
        } else if (testPatterns.some((p) => p.test(file))) {
          tests.push(fullPath);
        }
      }
    };

    try {
      findTests(srcDir);
    } catch {
      // Ignore errors
    }

    return tests;
  }

  private findAffectedDocumentation(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[]
  ): string[] {
    const docs: string[] = [];

    for (const impact of [...directImpacts, ...indirectImpacts]) {
      if (impact.targetType === 'page') {
        const page = this.pageCache.get(impact.targetId);
        if (page) {
          docs.push(`${page.title} (${page.metadata.category})`);
        }
      }
    }

    return [...new Set(docs)];
  }

  private calculateOverallRisk(
    directImpacts: ImpactItem[],
    indirectImpacts: ImpactItem[]
  ): RiskLevel {
    const allImpacts = [...directImpacts, ...indirectImpacts];

    const criticalCount = allImpacts.filter((i) => i.severity === 'critical').length;
    const highCount = allImpacts.filter((i) => i.severity === 'high').length;
    const mediumCount = allImpacts.filter((i) => i.severity === 'medium').length;

    if (criticalCount > 0 || highCount >= 3) return 'critical';
    if (highCount > 0 || mediumCount >= 5) return 'high';
    if (mediumCount > 0 || allImpacts.length >= 5) return 'medium';
    return 'low';
  }

  private calculateConfidence(directImpacts: ImpactItem[], indirectImpacts: ImpactItem[]): number {
    if (directImpacts.length === 0) return 0.5;

    const directConfidence =
      directImpacts.reduce((sum, i) => sum + i.confidence, 0) / directImpacts.length;
    const indirectConfidence =
      indirectImpacts.length > 0
        ? indirectImpacts.reduce((sum, i) => sum + i.confidence, 0) / indirectImpacts.length
        : 0.5;

    return directConfidence * 0.7 + indirectConfidence * 0.3;
  }

  private generateImpactId(): string {
    const hash = crypto
      .createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
    return `ii-${hash}`;
  }
}
