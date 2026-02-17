import { ParsedFile, SymbolKind } from '../../types';
import { SymbolTracker, SymbolSnapshot } from './symbol-tracker';
import { ChangeInfo, ChangeType } from './types';

export interface ImpactNode {
  id: string;
  type: 'file' | 'symbol' | 'page';
  name: string;
  impactLevel: 'high' | 'medium' | 'low';
  changeType: ChangeType;
  affectedBy: string[];
}

export interface ImpactEdge {
  source: string;
  target: string;
  type: 'dependency' | 'reference' | 'contains';
  weight: number;
}

export interface ImpactResult {
  directImpacts: ImpactNode[];
  indirectImpacts: ImpactNode[];
  affectedPages: AffectedPageInfo[];
  updatePriority: UpdatePriorityInfo[];
  estimatedEffort: number;
  riskAssessment: RiskAssessment;
}

export interface AffectedPageInfo {
  pageId: string;
  pageTitle: string;
  impactType: 'content' | 'reference' | 'metadata';
  priority: 'critical' | 'high' | 'normal' | 'low';
  affectedSymbols: string[];
  estimatedChanges: number;
  reason: string;
}

export interface UpdatePriorityInfo {
  pageId: string;
  priority: number;
  dependencies: string[];
  estimatedTime: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
  mitigationSuggestions: string[];
  breakingChanges: boolean;
}

export class ImpactAnalyzer {
  private symbolTracker: SymbolTracker;
  private fileSymbolMap: Map<string, Set<string>> = new Map();
  private symbolPageMap: Map<string, Set<string>> = new Map();
  private pageDependencyMap: Map<string, Set<string>> = new Map();

  constructor() {
    this.symbolTracker = new SymbolTracker();
  }

  initialize(files: ParsedFile[]): void {
    this.symbolTracker.buildFromFiles(files);
    this.buildMappings(files);
  }

  analyzeImpact(changes: ChangeInfo[]): ImpactResult {
    const directImpacts = this.analyzeDirectImpacts(changes);
    const indirectImpacts = this.analyzeIndirectImpacts(directImpacts);
    const affectedPages = this.analyzeAffectedPages(directImpacts, indirectImpacts);
    const updatePriority = this.calculateUpdatePriority(affectedPages);
    const estimatedEffort = this.estimateEffort(directImpacts, indirectImpacts, affectedPages);
    const riskAssessment = this.assessRisk(changes, directImpacts, indirectImpacts);

    return {
      directImpacts,
      indirectImpacts,
      affectedPages,
      updatePriority,
      estimatedEffort,
      riskAssessment,
    };
  }

  getAffectedPagesForFile(filePath: string): string[] {
    const symbolIds = this.fileSymbolMap.get(filePath);
    if (!symbolIds) {
      return [];
    }

    const pages = new Set<string>();
    for (const symbolId of symbolIds) {
      const symbolPages = this.symbolPageMap.get(symbolId);
      if (symbolPages) {
        for (const pageId of symbolPages) {
          pages.add(pageId);
        }
      }
    }

    return Array.from(pages);
  }

  getAffectedPagesForSymbol(symbolId: string): string[] {
    const pages = this.symbolPageMap.get(symbolId);
    return pages ? Array.from(pages) : [];
  }

  getUpdateOrder(affectedPages: AffectedPageInfo[]): string[][] {
    const pageMap = new Map<string, AffectedPageInfo>();
    for (const page of affectedPages) {
      pageMap.set(page.pageId, page);
    }

    const visited = new Set<string>();
    const result: string[][] = [];
    const visiting = new Set<string>();

    const visit = (pageId: string, depth: number): void => {
      if (visited.has(pageId)) {
        return;
      }

      if (visiting.has(pageId)) {
        return;
      }

      visiting.add(pageId);

      const deps = this.pageDependencyMap.get(pageId);
      if (deps) {
        for (const depId of deps) {
          if (pageMap.has(depId)) {
            visit(depId, depth + 1);
          }
        }
      }

      visiting.delete(pageId);
      visited.add(pageId);

      while (result.length <= depth) {
        result.push([]);
      }
      result[depth].push(pageId);
    };

    for (const page of affectedPages) {
      visit(page.pageId, 0);
    }

    return result;
  }

  private buildMappings(files: ParsedFile[]): void {
    this.fileSymbolMap.clear();
    this.symbolPageMap.clear();
    this.pageDependencyMap.clear();

    for (const file of files) {
      const filePath = file.path;
      const symbolIds = new Set<string>();

      for (const symbol of file.symbols) {
        const symbolId = `${filePath}:${symbol.name}:${symbol.kind}`;
        symbolIds.add(symbolId);

        const moduleName = this.extractModuleName(filePath);
        const modulePageId = `module-${moduleName}`;

        if (!this.symbolPageMap.has(symbolId)) {
          this.symbolPageMap.set(symbolId, new Set());
        }
        this.symbolPageMap.get(symbolId)!.add(modulePageId);

        const isExported = symbol.modifiers?.includes('export') || symbol.modifiers?.includes('public');
        if (isExported) {
          this.symbolPageMap.get(symbolId)!.add('api-reference');
        }
      }

      this.fileSymbolMap.set(filePath, symbolIds);
    }

    this.buildPageDependencies();
  }

  private buildPageDependencies(): void {
    this.pageDependencyMap.set('overview', new Set(['architecture']));
    this.pageDependencyMap.set('architecture', new Set());

    const modulePages = new Set<string>();
    for (const symbolPages of this.symbolPageMap.values()) {
      for (const pageId of symbolPages) {
        if (pageId.startsWith('module-')) {
          modulePages.add(pageId);
        }
      }
    }

    for (const modulePage of modulePages) {
      this.pageDependencyMap.set(modulePage, new Set(['api-reference']));
    }

    this.pageDependencyMap.set('api-reference', new Set());
  }

  private analyzeDirectImpacts(changes: ChangeInfo[]): ImpactNode[] {
    const impacts: ImpactNode[] = [];

    for (const change of changes) {
      const impact: ImpactNode = {
        id: `file:${change.filePath}`,
        type: 'file',
        name: change.filePath,
        impactLevel: this.getFileImpactLevel(change),
        changeType: change.changeType,
        affectedBy: [],
      };

      const symbolIds = this.fileSymbolMap.get(change.filePath);
      if (symbolIds) {
        for (const symbolId of symbolIds) {
          const symbol = this.symbolTracker.getSymbol(symbolId);
          if (symbol) {
            impacts.push({
              id: `symbol:${symbolId}`,
              type: 'symbol',
              name: symbol.name,
              impactLevel: this.getSymbolImpactLevel(symbol, change.changeType),
              changeType: change.changeType,
              affectedBy: [impact.id],
            });
          }
        }
      }

      impacts.push(impact);
    }

    return impacts;
  }

  private analyzeIndirectImpacts(directImpacts: ImpactNode[]): ImpactNode[] {
    const indirectImpacts: ImpactNode[] = [];
    const processedIds = new Set<string>();

    for (const impact of directImpacts) {
      if (impact.type !== 'symbol') {
        continue;
      }

      const symbolId = impact.id.replace('symbol:', '');
      const dependents = this.symbolTracker.getSymbolDependents(symbolId);

      for (const dependent of dependents) {
        const indirectId = `symbol:${dependent.id}`;
        if (processedIds.has(indirectId)) {
          continue;
        }

        processedIds.add(indirectId);

        indirectImpacts.push({
          id: indirectId,
          type: 'symbol',
          name: dependent.name,
          impactLevel: this.propagateImpactLevel(impact.impactLevel),
          changeType: 'modified',
          affectedBy: [impact.id],
        });
      }
    }

    return indirectImpacts;
  }

  private analyzeAffectedPages(
    directImpacts: ImpactNode[],
    indirectImpacts: ImpactNode[]
  ): AffectedPageInfo[] {
    const pageImpacts = new Map<string, AffectedPageInfo>();

    const allImpacts = [...directImpacts, ...indirectImpacts];

    for (const impact of allImpacts) {
      if (impact.type !== 'symbol') {
        continue;
      }

      const symbolId = impact.id.replace('symbol:', '');
      const pages = this.symbolPageMap.get(symbolId);

      if (!pages) {
        continue;
      }

      for (const pageId of pages) {
        if (!pageImpacts.has(pageId)) {
          pageImpacts.set(pageId, {
            pageId,
            pageTitle: this.getPageTitle(pageId),
            impactType: 'content',
            priority: this.mapImpactToPriority(impact.impactLevel),
            affectedSymbols: [],
            estimatedChanges: 0,
            reason: '',
          });
        }

        const pageInfo = pageImpacts.get(pageId)!;
        pageInfo.affectedSymbols.push(symbolId);
        pageInfo.estimatedChanges++;

        if (impact.impactLevel === 'high') {
          pageInfo.priority = 'critical';
        }

        pageInfo.reason = this.generateReason(pageInfo);
      }
    }

    return Array.from(pageImpacts.values());
  }

  private calculateUpdatePriority(affectedPages: AffectedPageInfo[]): UpdatePriorityInfo[] {
    const priorities: UpdatePriorityInfo[] = [];

    for (const page of affectedPages) {
      const deps = this.pageDependencyMap.get(page.pageId) || new Set();

      priorities.push({
        pageId: page.pageId,
        priority: this.priorityToNumber(page.priority),
        dependencies: Array.from(deps).filter(d => affectedPages.some(p => p.pageId === d)),
        estimatedTime: page.estimatedChanges * 50,
      });
    }

    return priorities.sort((a, b) => a.priority - b.priority);
  }

  private estimateEffort(
    directImpacts: ImpactNode[],
    indirectImpacts: ImpactNode[],
    affectedPages: AffectedPageInfo[]
  ): number {
    const baseEffort = 100;
    const directEffort = directImpacts.length * baseEffort;
    const indirectEffort = indirectImpacts.length * baseEffort * 0.5;
    const pageEffort = affectedPages.reduce((sum, p) => sum + p.estimatedChanges * 30, 0);

    return directEffort + indirectEffort + pageEffort;
  }

  private assessRisk(
    changes: ChangeInfo[],
    directImpacts: ImpactNode[],
    indirectImpacts: ImpactNode[]
  ): RiskAssessment {
    const riskFactors: string[] = [];
    const mitigationSuggestions: string[] = [];
    let breakingChanges = false;

    const deletedCount = changes.filter(c => c.changeType === 'deleted').length;
    if (deletedCount > 0) {
      riskFactors.push(`${deletedCount} file(s) deleted`);
      breakingChanges = true;
    }

    const highImpactCount = directImpacts.filter(i => i.impactLevel === 'high').length;
    if (highImpactCount > 5) {
      riskFactors.push(`${highImpactCount} high-impact changes`);
    }

    if (indirectImpacts.length > 20) {
      riskFactors.push(`${indirectImpacts.length} indirect impacts detected`);
      mitigationSuggestions.push('Consider updating in smaller batches');
    }

    const exportedChanges = directImpacts.filter(i =>
      i.type === 'symbol' && i.impactLevel === 'high'
    ).length;
    if (exportedChanges > 0) {
      riskFactors.push(`${exportedChanges} exported symbol(s) affected`);
      mitigationSuggestions.push('Review API documentation for breaking changes');
    }

    let overallRisk: 'low' | 'medium' | 'high';
    if (breakingChanges || highImpactCount > 10 || indirectImpacts.length > 50) {
      overallRisk = 'high';
    } else if (highImpactCount > 3 || indirectImpacts.length > 10) {
      overallRisk = 'medium';
    } else {
      overallRisk = 'low';
    }

    if (overallRisk === 'high') {
      mitigationSuggestions.push('Consider full regeneration instead of incremental update');
    }

    return {
      overallRisk,
      riskFactors,
      mitigationSuggestions,
      breakingChanges,
    };
  }

  private getFileImpactLevel(change: ChangeInfo): 'high' | 'medium' | 'low' {
    if (change.changeType === 'deleted') {
      return 'high';
    }
    if (change.changeType === 'added') {
      return 'low';
    }
    return 'medium';
  }

  private getSymbolImpactLevel(symbol: SymbolSnapshot, changeType: ChangeType): 'high' | 'medium' | 'low' {
    if (changeType === 'deleted') {
      return 'high';
    }

    if (symbol.exported) {
      return 'high';
    }

    if (symbol.kind === SymbolKind.Class || symbol.kind === SymbolKind.Interface) {
      return 'medium';
    }

    return 'low';
  }

  private propagateImpactLevel(level: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
    const mapping: Record<string, 'high' | 'medium' | 'low'> = {
      high: 'medium',
      medium: 'low',
      low: 'low',
    };
    return mapping[level];
  }

  private mapImpactToPriority(level: 'high' | 'medium' | 'low'): 'critical' | 'high' | 'normal' | 'low' {
    const mapping: Record<string, 'critical' | 'high' | 'normal' | 'low'> = {
      high: 'critical',
      medium: 'normal',
      low: 'low',
    };
    return mapping[level];
  }

  private priorityToNumber(priority: 'critical' | 'high' | 'normal' | 'low'): number {
    const mapping: Record<string, number> = {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4,
    };
    return mapping[priority];
  }

  private getPageTitle(pageId: string): string {
    if (pageId === 'overview') {
      return 'Project Overview';
    }
    if (pageId === 'architecture') {
      return 'Architecture';
    }
    if (pageId === 'api-reference') {
      return 'API Reference';
    }
    if (pageId.startsWith('module-')) {
      return `Module: ${pageId.replace('module-', '')}`;
    }
    return pageId;
  }

  private generateReason(pageInfo: AffectedPageInfo): string {
    const parts: string[] = [];

    if (pageInfo.affectedSymbols.length > 0) {
      parts.push(`${pageInfo.affectedSymbols.length} symbol(s) affected`);
    }

    if (pageInfo.priority === 'critical') {
      parts.push('high impact changes');
    }

    return parts.join(', ') || 'Changes detected';
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split('/');
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1];
    }
    return parts[parts.length - 2] || 'root';
  }
}
