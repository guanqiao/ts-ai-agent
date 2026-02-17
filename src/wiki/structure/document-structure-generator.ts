import * as crypto from 'crypto';
import { ParsedFile, SymbolKind } from '../../types';
import {
  DocumentSection,
  SectionHierarchy,
  SectionType,
  SectionPriority,
  StructureAnalysisResult,
  StructureRecommendation,
  ArchitectureContext,
  IStructureGenerator,
} from './types';

export class DocumentStructureGenerator implements IStructureGenerator {
  constructor(_llmService?: unknown, _options?: unknown) {}

  async generateStructure(
    parsedFiles: ParsedFile[],
    architecture: ArchitectureContext
  ): Promise<SectionHierarchy> {
    const sections = await this.buildSections(parsedFiles, architecture);
    const organizedSections = this.organizeSections(sections);
    const flatSections = this.flattenSections(organizedSections);
    const maxDepth = this.calculateMaxDepth(organizedSections);

    return {
      root: this.createRootSection(organizedSections),
      flatSections,
      maxDepth,
      totalSections: flatSections.length,
    };
  }

  async analyzeContent(
    sections: DocumentSection[],
    parsedFiles: ParsedFile[]
  ): Promise<StructureAnalysisResult> {
    const suggestedSections = await this.suggestSections(parsedFiles, sections);
    const existingSections = sections;
    const missingSections = this.findMissingSections(suggestedSections, existingSections);
    const redundantSections = this.findRedundantSections(existingSections, parsedFiles);
    const recommendations = this.generateRecommendations(
      missingSections,
      redundantSections,
      existingSections
    );

    return {
      suggestedSections,
      existingSections,
      missingSections,
      redundantSections,
      recommendations,
    };
  }

  async suggestSections(
    parsedFiles: ParsedFile[],
    existingSections: DocumentSection[]
  ): Promise<DocumentSection[]> {
    const suggestions: DocumentSection[] = [];
    const existingTypes = new Set(existingSections.map((s) => s.type));

    const projectStats = this.analyzeProjectStats(parsedFiles);

    if (!existingTypes.has(SectionType.Overview)) {
      suggestions.push(
        this.createSection(SectionType.Overview, 'Overview', SectionPriority.Critical)
      );
    }

    if (!existingTypes.has(SectionType.Architecture) && projectStats.hasMultipleModules) {
      suggestions.push(
        this.createSection(SectionType.Architecture, 'Architecture', SectionPriority.High)
      );
    }

    if (!existingTypes.has(SectionType.Module) && projectStats.moduleCount > 1) {
      suggestions.push(this.createSection(SectionType.Module, 'Modules', SectionPriority.High));
    }

    if (!existingTypes.has(SectionType.API) && projectStats.publicApiCount > 0) {
      suggestions.push(this.createSection(SectionType.API, 'API Reference', SectionPriority.High));
    }

    if (!existingTypes.has(SectionType.Guide) && projectStats.hasEntryPoints) {
      suggestions.push(
        this.createSection(SectionType.Guide, 'Getting Started', SectionPriority.High)
      );
    }

    if (!existingTypes.has(SectionType.Example) && projectStats.hasTests) {
      suggestions.push(this.createSection(SectionType.Example, 'Examples', SectionPriority.Medium));
    }

    if (!existingTypes.has(SectionType.Config) && projectStats.hasConfig) {
      suggestions.push(
        this.createSection(SectionType.Config, 'Configuration', SectionPriority.Medium)
      );
    }

    return suggestions;
  }

  private async buildSections(
    parsedFiles: ParsedFile[],
    architecture: ArchitectureContext
  ): Promise<DocumentSection[]> {
    const sections: DocumentSection[] = [];

    sections.push(this.buildOverviewSection(parsedFiles, architecture));
    sections.push(this.buildArchitectureSection(architecture));

    const moduleSections = this.buildModuleSections(parsedFiles, architecture);
    sections.push(...moduleSections);

    const apiSections = this.buildAPISections(parsedFiles);
    if (apiSections.length > 0) {
      sections.push(...apiSections);
    }

    return sections;
  }

  private buildOverviewSection(
    _parsedFiles: ParsedFile[],
    _architecture: ArchitectureContext
  ): DocumentSection {
    return {
      id: 'overview',
      title: 'Overview',
      type: SectionType.Overview,
      priority: SectionPriority.Critical,
      level: 1,
      children: [],
      metadata: {
        tags: ['overview', 'summary'],
        category: 'overview',
        wordCount: 0,
      },
      sourceFiles: _parsedFiles.map((f) => f.path),
      symbols: [],
    };
  }

  private buildArchitectureSection(architecture: ArchitectureContext): DocumentSection {
    const children: DocumentSection[] = [];

    if (architecture.pattern) {
      children.push({
        id: 'architecture-pattern',
        title: 'Architecture Pattern',
        type: SectionType.Architecture,
        priority: SectionPriority.High,
        level: 2,
        children: [],
        metadata: {
          tags: ['architecture', 'pattern'],
          category: 'architecture',
        },
        sourceFiles: [],
        symbols: [],
      });
    }

    if (architecture.layers && architecture.layers.length > 0) {
      children.push({
        id: 'architecture-layers',
        title: 'Layers',
        type: SectionType.Architecture,
        priority: SectionPriority.High,
        level: 2,
        children: architecture.layers.map((layer, index) => ({
          id: `layer-${index}`,
          title: layer.name,
          type: SectionType.Architecture,
          priority: SectionPriority.High,
          level: 3,
          children: [],
          metadata: {
            tags: ['layer', layer.name.toLowerCase()],
            category: 'architecture',
          },
          sourceFiles: [],
          symbols: [],
        })),
        metadata: {
          tags: ['architecture', 'layers'],
          category: 'architecture',
        },
        sourceFiles: [],
        symbols: [],
      });
    }

    return {
      id: 'architecture',
      title: 'Architecture',
      type: SectionType.Architecture,
      priority: SectionPriority.High,
      level: 1,
      children,
      metadata: {
        tags: ['architecture'],
        category: 'architecture',
      },
      sourceFiles: [],
      symbols: [],
    };
  }

  private buildModuleSections(
    parsedFiles: ParsedFile[],
    _architecture: ArchitectureContext
  ): DocumentSection[] {
    const moduleMap = this.groupFilesByModule(parsedFiles);
    const sections: DocumentSection[] = [];

    for (const [moduleName, files] of moduleMap) {
      const symbols = files.flatMap((f) => f.symbols);
      const publicSymbols = symbols.filter((s) => !s.modifiers?.includes('private'));

      sections.push({
        id: `module-${this.generateId(moduleName)}`,
        title: `Module: ${moduleName}`,
        type: SectionType.Module,
        priority: SectionPriority.High,
        level: 1,
        children: this.buildModuleSubSections(files),
        metadata: {
          tags: ['module', moduleName.toLowerCase()],
          category: 'module',
        },
        sourceFiles: files.map((f) => f.path),
        symbols: publicSymbols.map((s) => s.name),
      });
    }

    return sections;
  }

  private buildModuleSubSections(files: ParsedFile[]): DocumentSection[] {
    const subSections: DocumentSection[] = [];
    const symbols = files.flatMap((f) => f.symbols);

    const classes = symbols.filter((s) => s.kind === SymbolKind.Class);
    const interfaces = symbols.filter((s) => s.kind === SymbolKind.Interface);
    const functions = symbols.filter(
      (s) => s.kind === SymbolKind.Function || s.kind === SymbolKind.Method
    );

    if (classes.length > 0) {
      subSections.push({
        id: `classes-${this.generateId(files[0].path)}`,
        title: 'Classes',
        type: SectionType.Reference,
        priority: SectionPriority.High,
        level: 2,
        children: classes.map((c) => ({
          id: `class-${this.generateId(c.name)}`,
          title: c.name,
          type: SectionType.Reference,
          priority: SectionPriority.Medium,
          level: 3,
          children: [],
          metadata: {
            tags: ['class', c.name.toLowerCase()],
            category: 'reference',
          },
          sourceFiles: files.filter((f) => f.symbols.includes(c)).map((f) => f.path),
          symbols: [c.name],
        })),
        metadata: {
          tags: ['classes'],
          category: 'reference',
        },
        sourceFiles: files.map((f) => f.path),
        symbols: classes.map((c) => c.name),
      });
    }

    if (interfaces.length > 0) {
      subSections.push({
        id: `interfaces-${this.generateId(files[0].path)}`,
        title: 'Interfaces',
        type: SectionType.Reference,
        priority: SectionPriority.High,
        level: 2,
        children: interfaces.map((i) => ({
          id: `interface-${this.generateId(i.name)}`,
          title: i.name,
          type: SectionType.Reference,
          priority: SectionPriority.Medium,
          level: 3,
          children: [],
          metadata: {
            tags: ['interface', i.name.toLowerCase()],
            category: 'reference',
          },
          sourceFiles: files.filter((f) => f.symbols.includes(i)).map((f) => f.path),
          symbols: [i.name],
        })),
        metadata: {
          tags: ['interfaces'],
          category: 'reference',
        },
        sourceFiles: files.map((f) => f.path),
        symbols: interfaces.map((i) => i.name),
      });
    }

    if (functions.length > 0) {
      subSections.push({
        id: `functions-${this.generateId(files[0].path)}`,
        title: 'Functions',
        type: SectionType.Reference,
        priority: SectionPriority.Medium,
        level: 2,
        children: [],
        metadata: {
          tags: ['functions'],
          category: 'reference',
        },
        sourceFiles: files.map((f) => f.path),
        symbols: functions.map((f) => f.name),
      });
    }

    return subSections;
  }

  private buildAPISections(parsedFiles: ParsedFile[]): DocumentSection[] {
    const publicAPIs = this.extractPublicAPIs(parsedFiles);

    if (publicAPIs.length === 0) {
      return [];
    }

    const apiByCategory = this.groupAPIsByCategory(publicAPIs);
    const sections: DocumentSection[] = [];

    for (const [category, apis] of apiByCategory) {
      sections.push({
        id: `api-${this.generateId(category)}`,
        title: `${category} API`,
        type: SectionType.API,
        priority: SectionPriority.High,
        level: 1,
        children: apis.map((api) => ({
          id: `api-${this.generateId(api.name)}`,
          title: api.name,
          type: SectionType.API,
          priority: SectionPriority.Medium,
          level: 2,
          children: [],
          metadata: {
            tags: ['api', api.name.toLowerCase()],
            category: 'api',
          },
          sourceFiles: [api.filePath],
          symbols: [api.name],
        })),
        metadata: {
          tags: ['api', category.toLowerCase()],
          category: 'api',
        },
        sourceFiles: [...new Set(apis.map((a) => a.filePath))],
        symbols: apis.map((a) => a.name),
      });
    }

    return sections;
  }

  private organizeSections(sections: DocumentSection[]): DocumentSection[] {
    return sections
      .sort((a, b) => a.priority - b.priority)
      .map((section) => ({
        ...section,
        children: this.organizeSections(section.children),
      }));
  }

  private flattenSections(sections: DocumentSection[]): DocumentSection[] {
    const result: DocumentSection[] = [];

    const flatten = (section: DocumentSection) => {
      result.push(section);
      for (const child of section.children) {
        flatten(child);
      }
    };

    for (const section of sections) {
      flatten(section);
    }

    return result;
  }

  private calculateMaxDepth(sections: DocumentSection[]): number {
    if (sections.length === 0) return 0;

    return Math.max(
      ...sections.map((s) => {
        if (s.children.length === 0) return s.level;
        return this.calculateMaxDepth(s.children);
      })
    );
  }

  private createRootSection(sections: DocumentSection[]): DocumentSection {
    return {
      id: 'root',
      title: 'Documentation',
      type: SectionType.Overview,
      priority: SectionPriority.Critical,
      level: 0,
      children: sections,
      metadata: {
        tags: ['root'],
        category: 'overview',
      },
      sourceFiles: [],
      symbols: [],
    };
  }

  private createSection(
    type: SectionType,
    title: string,
    priority: SectionPriority
  ): DocumentSection {
    return {
      id: this.generateId(title),
      title,
      type,
      priority,
      level: 1,
      children: [],
      metadata: {
        tags: [type.toString()],
        category: type.toString(),
      },
      sourceFiles: [],
      symbols: [],
    };
  }

  private findMissingSections(
    suggested: DocumentSection[],
    existing: DocumentSection[]
  ): DocumentSection[] {
    const existingTypes = new Set(existing.map((s) => s.type));
    return suggested.filter((s) => !existingTypes.has(s.type));
  }

  private findRedundantSections(
    sections: DocumentSection[],
    parsedFiles: ParsedFile[]
  ): DocumentSection[] {
    const redundant: DocumentSection[] = [];
    const filePaths = new Set(parsedFiles.map((f) => f.path));

    for (const section of sections) {
      const validSources = section.sourceFiles.filter((f) => filePaths.has(f));
      if (validSources.length === 0 && section.sourceFiles.length > 0) {
        redundant.push(section);
      }
    }

    return redundant;
  }

  private generateRecommendations(
    missing: DocumentSection[],
    redundant: DocumentSection[],
    existing: DocumentSection[]
  ): StructureRecommendation[] {
    const recommendations: StructureRecommendation[] = [];

    for (const section of missing) {
      recommendations.push({
        type: 'add',
        sectionId: section.id,
        reason: `Missing recommended section: ${section.title}`,
        priority: section.priority,
      });
    }

    for (const section of redundant) {
      recommendations.push({
        type: 'remove',
        sectionId: section.id,
        reason: `Section references non-existent files`,
        priority: SectionPriority.Low,
      });
    }

    const sectionsByType = this.groupBy(existing, 'type');
    for (const [, sections] of sectionsByType) {
      if (sections.length > 5) {
        recommendations.push({
          type: 'merge',
          targetSectionId: sections[0].id,
          reason: `Too many sections of type ${sections[0].type}, consider merging`,
          priority: SectionPriority.Medium,
        });
      }
    }

    return recommendations;
  }

  private analyzeProjectStats(parsedFiles: ParsedFile[]): {
    hasMultipleModules: boolean;
    moduleCount: number;
    publicApiCount: number;
    hasEntryPoints: boolean;
    hasTests: boolean;
    hasConfig: boolean;
  } {
    const moduleMap = this.groupFilesByModule(parsedFiles);
    const publicAPIs = this.extractPublicAPIs(parsedFiles);
    const hasEntryPoints = parsedFiles.some(
      (f) => f.path.includes('index.') || f.path.includes('main.')
    );
    const hasTests = parsedFiles.some(
      (f) => f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__')
    );
    const hasConfig = parsedFiles.some(
      (f) =>
        f.path.includes('config') || f.path.endsWith('.config.ts') || f.path.endsWith('.config.js')
    );

    return {
      hasMultipleModules: moduleMap.size > 1,
      moduleCount: moduleMap.size,
      publicApiCount: publicAPIs.length,
      hasEntryPoints,
      hasTests,
      hasConfig,
    };
  }

  private groupFilesByModule(parsedFiles: ParsedFile[]): Map<string, ParsedFile[]> {
    const moduleMap = new Map<string, ParsedFile[]>();

    for (const file of parsedFiles) {
      const moduleName = this.extractModuleName(file.path);
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }
      moduleMap.get(moduleName)!.push(file);
    }

    return moduleMap;
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    const srcIndex = parts.findIndex((p) => p === 'src');
    if (srcIndex >= 0 && srcIndex < parts.length - 2) {
      return parts[srcIndex + 1];
    }
    return parts[parts.length - 2] || 'root';
  }

  private extractPublicAPIs(parsedFiles: ParsedFile[]): Array<{
    name: string;
    kind: SymbolKind;
    filePath: string;
    description?: string;
  }> {
    const apis: Array<{
      name: string;
      kind: SymbolKind;
      filePath: string;
      description?: string;
    }> = [];

    for (const file of parsedFiles) {
      for (const symbol of file.symbols) {
        if (
          (symbol.kind === SymbolKind.Class ||
            symbol.kind === SymbolKind.Interface ||
            symbol.kind === SymbolKind.Function) &&
          !symbol.modifiers?.includes('private')
        ) {
          apis.push({
            name: symbol.name,
            kind: symbol.kind,
            filePath: file.path,
            description: symbol.description,
          });
        }
      }
    }

    return apis;
  }

  private groupAPIsByCategory(
    apis: Array<{ name: string; kind: SymbolKind; filePath: string; description?: string }>
  ): Map<
    string,
    Array<{ name: string; kind: SymbolKind; filePath: string; description?: string }>
  > {
    const categoryMap = new Map<
      string,
      Array<{
        name: string;
        kind: SymbolKind;
        filePath: string;
        description?: string;
      }>
    >();

    for (const api of apis) {
      const category = this.getSymbolCategory(api.kind);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(api);
    }

    return categoryMap;
  }

  private getSymbolCategory(kind: SymbolKind): string {
    switch (kind) {
      case SymbolKind.Class:
        return 'Classes';
      case SymbolKind.Interface:
        return 'Interfaces';
      case SymbolKind.Function:
      case SymbolKind.Method:
        return 'Functions';
      case SymbolKind.Enum:
        return 'Enums';
      case SymbolKind.TypeAlias:
        return 'Types';
      default:
        return 'Other';
    }
  }

  private groupBy<T>(array: T[], key: keyof T): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of array) {
      const value = String(item[key]);
      if (!map.has(value)) {
        map.set(value, []);
      }
      map.get(value)!.push(item);
    }
    return map;
  }

  private generateId(name: string): string {
    return crypto.createHash('md5').update(name).digest('hex').substring(0, 8);
  }
}
