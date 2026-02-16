import { ParsedFile, SymbolKind } from '../../types';
import { LLMService } from '../../llm';
import {
  DocumentSection,
  SectionType,
  SectionPriority,
} from './types';

export interface SectionRecommendation {
  section: DocumentSection;
  confidence: number;
  reason: string;
  dependencies: string[];
}

export class SectionRecommender {
  private llmService: LLMService | null = null;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
  }

  async recommendSections(
    parsedFiles: ParsedFile[],
    existingSections: DocumentSection[]
  ): Promise<SectionRecommendation[]> {
    const recommendations: SectionRecommendation[] = [];
    const projectAnalysis = this.analyzeProject(parsedFiles);
    const existingTypes = new Set(existingSections.map((s) => s.type));

    const baseRecommendations = this.getBaseRecommendations(projectAnalysis, existingTypes);
    recommendations.push(...baseRecommendations);

    if (this.llmService) {
      const aiRecommendations = await this.getAIRecommendations(parsedFiles, existingSections);
      recommendations.push(...aiRecommendations);
    }

    return this.prioritizeRecommendations(recommendations);
  }

  prioritizeSections(sections: DocumentSection[]): DocumentSection[] {
    return sections.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return this.getTypeWeight(b.type) - this.getTypeWeight(a.type);
    });
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  private analyzeProject(parsedFiles: ParsedFile[]): ProjectAnalysis {
    const stats = {
      totalFiles: parsedFiles.length,
      totalSymbols: parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0),
      classes: 0,
      interfaces: 0,
      functions: 0,
      enums: 0,
      typeAliases: 0,
      exportedSymbols: 0,
      testFiles: 0,
      configFiles: 0,
      entryPoints: 0,
    };

    const modules = new Set<string>();
    const categories = new Set<string>();

    for (const file of parsedFiles) {
      const moduleName = this.extractModuleName(file.path);
      modules.add(moduleName);

      if (file.path.includes('.test.') || file.path.includes('.spec.')) {
        stats.testFiles++;
      }
      if (file.path.includes('config') || file.path.endsWith('.config.ts')) {
        stats.configFiles++;
      }
      if (file.path.includes('index.') || file.path.includes('main.')) {
        stats.entryPoints++;
      }

      for (const symbol of file.symbols) {
        switch (symbol.kind) {
          case SymbolKind.Class:
            stats.classes++;
            break;
          case SymbolKind.Interface:
            stats.interfaces++;
            break;
          case SymbolKind.Function:
          case SymbolKind.Method:
            stats.functions++;
            break;
          case SymbolKind.Enum:
            stats.enums++;
            break;
          case SymbolKind.TypeAlias:
            stats.typeAliases++;
            break;
        }
        if (!symbol.modifiers?.includes('private')) {
          stats.exportedSymbols++;
        }
      }
    }

    return {
      stats,
      moduleCount: modules.size,
      categories: Array.from(categories),
      hasTests: stats.testFiles > 0,
      hasConfig: stats.configFiles > 0,
      hasEntryPoints: stats.entryPoints > 0,
      hasPublicAPI: stats.exportedSymbols > 0,
    };
  }

  private getBaseRecommendations(
    analysis: ProjectAnalysis,
    existingTypes: Set<SectionType>
  ): SectionRecommendation[] {
    const recommendations: SectionRecommendation[] = [];

    if (!existingTypes.has(SectionType.Overview)) {
      recommendations.push({
        section: this.createSection(SectionType.Overview, 'Overview', SectionPriority.Critical),
        confidence: 1.0,
        reason: 'Every project should have an overview section',
        dependencies: [],
      });
    }

    if (!existingTypes.has(SectionType.Architecture) && analysis.moduleCount > 1) {
      recommendations.push({
        section: this.createSection(SectionType.Architecture, 'Architecture', SectionPriority.High),
        confidence: 0.9,
        reason: 'Multi-module project benefits from architecture documentation',
        dependencies: ['overview'],
      });
    }

    if (!existingTypes.has(SectionType.Module) && analysis.moduleCount > 1) {
      recommendations.push({
        section: this.createSection(SectionType.Module, 'Modules', SectionPriority.High),
        confidence: 0.85,
        reason: `Project has ${analysis.moduleCount} modules that should be documented`,
        dependencies: ['overview'],
      });
    }

    if (!existingTypes.has(SectionType.API) && analysis.hasPublicAPI) {
      recommendations.push({
        section: this.createSection(SectionType.API, 'API Reference', SectionPriority.High),
        confidence: 0.9,
        reason: `Project exports ${analysis.stats.exportedSymbols} public symbols`,
        dependencies: ['overview'],
      });
    }

    if (!existingTypes.has(SectionType.Guide) && analysis.hasEntryPoints) {
      recommendations.push({
        section: this.createSection(SectionType.Guide, 'Getting Started', SectionPriority.High),
        confidence: 0.8,
        reason: 'Project has entry points that need usage documentation',
        dependencies: ['overview'],
      });
    }

    if (!existingTypes.has(SectionType.Example) && analysis.hasTests) {
      recommendations.push({
        section: this.createSection(SectionType.Example, 'Examples', SectionPriority.Medium),
        confidence: 0.7,
        reason: 'Test files can be used as examples',
        dependencies: ['api-reference'],
      });
    }

    if (!existingTypes.has(SectionType.Config) && analysis.hasConfig) {
      recommendations.push({
        section: this.createSection(SectionType.Config, 'Configuration', SectionPriority.Medium),
        confidence: 0.75,
        reason: 'Project has configuration files',
        dependencies: ['getting-started'],
      });
    }

    if (!existingTypes.has(SectionType.Changelog)) {
      recommendations.push({
        section: this.createSection(SectionType.Changelog, 'Changelog', SectionPriority.Low),
        confidence: 0.5,
        reason: 'Recommended for tracking project changes',
        dependencies: [],
      });
    }

    if (!existingTypes.has(SectionType.Contributing)) {
      recommendations.push({
        section: this.createSection(SectionType.Contributing, 'Contributing', SectionPriority.Low),
        confidence: 0.4,
        reason: 'Useful for open source projects',
        dependencies: [],
      });
    }

    return recommendations;
  }

  private async getAIRecommendations(
    parsedFiles: ParsedFile[],
    existingSections: DocumentSection[]
  ): Promise<SectionRecommendation[]> {
    if (!this.llmService) return [];

    try {
      const projectSummary = this.summarizeProject(parsedFiles);
      const existingSummary = existingSections.map((s) => s.title).join(', ');

      const prompt = `Analyze this project and recommend additional documentation sections.

Project Summary:
${projectSummary}

Existing Sections:
${existingSummary || 'None'}

Recommend additional sections that would be valuable. Return a JSON array of objects with:
- type: section type (overview, architecture, module, api, guide, example, config, changelog, contributing)
- title: suggested title
- reason: why this section is needed
- priority: 1-5 (1 being highest)

Only recommend sections that are truly missing and valuable.`;

      const response = await this.llmService.complete([
        { role: 'user', content: prompt },
      ]);

      return this.parseAIResponse(response);
    } catch {
      return [];
    }
  }

  private parseAIResponse(response: string): SectionRecommendation[] {
    const recommendations: SectionRecommendation[] = [];

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const type = this.parseSectionType(item.type);
            const priority = this.parsePriority(item.priority);

            recommendations.push({
              section: this.createSection(type, item.title || type, priority),
              confidence: 0.8,
              reason: item.reason || 'AI recommended',
              dependencies: [],
            });
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return recommendations;
  }

  private prioritizeRecommendations(
    recommendations: SectionRecommendation[]
  ): SectionRecommendation[] {
    return recommendations.sort((a, b) => {
      const priorityDiff = a.section.priority - b.section.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  private createSection(
    type: SectionType,
    title: string,
    priority: SectionPriority
  ): DocumentSection {
    return {
      id: `recommended-${type}`,
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

  private getTypeWeight(type: SectionType): number {
    const weights: Record<SectionType, number> = {
      [SectionType.Overview]: 100,
      [SectionType.Architecture]: 90,
      [SectionType.Module]: 80,
      [SectionType.API]: 70,
      [SectionType.Guide]: 60,
      [SectionType.Example]: 50,
      [SectionType.Config]: 40,
      [SectionType.Reference]: 35,
      [SectionType.Decision]: 30,
      [SectionType.Test]: 25,
      [SectionType.Changelog]: 20,
      [SectionType.Contributing]: 15,
      [SectionType.Custom]: 10,
    };
    return weights[type] || 0;
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    const srcIndex = parts.findIndex((p) => p === 'src');
    if (srcIndex >= 0 && srcIndex < parts.length - 2) {
      return parts[srcIndex + 1];
    }
    return parts[parts.length - 2] || 'root';
  }

  private summarizeProject(parsedFiles: ParsedFile[]): string {
    const stats = {
      files: parsedFiles.length,
      symbols: parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0),
      modules: new Set(parsedFiles.map((f) => this.extractModuleName(f.path))).size,
    };

    const symbolTypes: Record<string, number> = {};
    for (const file of parsedFiles) {
      for (const symbol of file.symbols) {
        const kind = symbol.kind.toString();
        symbolTypes[kind] = (symbolTypes[kind] || 0) + 1;
      }
    }

    return `Files: ${stats.files}, Symbols: ${stats.symbols}, Modules: ${stats.modules}
Symbol breakdown: ${Object.entries(symbolTypes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}`;
  }

  private parseSectionType(type: string): SectionType {
    const typeMap: Record<string, SectionType> = {
      overview: SectionType.Overview,
      architecture: SectionType.Architecture,
      module: SectionType.Module,
      api: SectionType.API,
      guide: SectionType.Guide,
      example: SectionType.Example,
      config: SectionType.Config,
      changelog: SectionType.Changelog,
      contributing: SectionType.Contributing,
    };
    return typeMap[type.toLowerCase()] || SectionType.Custom;
  }

  private parsePriority(priority: number): SectionPriority {
    if (priority <= 1) return SectionPriority.Critical;
    if (priority === 2) return SectionPriority.High;
    if (priority === 3) return SectionPriority.Medium;
    if (priority === 4) return SectionPriority.Low;
    return SectionPriority.Optional;
  }
}

interface ProjectAnalysis {
  stats: {
    totalFiles: number;
    totalSymbols: number;
    classes: number;
    interfaces: number;
    functions: number;
    enums: number;
    typeAliases: number;
    exportedSymbols: number;
    testFiles: number;
    configFiles: number;
    entryPoints: number;
  };
  moduleCount: number;
  categories: string[];
  hasTests: boolean;
  hasConfig: boolean;
  hasEntryPoints: boolean;
  hasPublicAPI: boolean;
}
