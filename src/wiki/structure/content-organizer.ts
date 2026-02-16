import {
  DocumentSection,
  ContentOrganizationOptions,
  DEFAULT_ORGANIZATION_OPTIONS,
  SectionType,
} from './types';

export interface OrganizedContent {
  sections: DocumentSection[];
  mergedCount: number;
  splitCount: number;
  reorganized: boolean;
}

export class ContentOrganizer {
  private options: ContentOrganizationOptions;

  constructor(options?: Partial<ContentOrganizationOptions>) {
    this.options = { ...DEFAULT_ORGANIZATION_OPTIONS, ...options };
  }

  organizeContent(sections: DocumentSection[]): OrganizedContent {
    let result = [...sections];
    let mergedCount = 0;
    let splitCount = 0;

    result = this.mergeSmallSections(result);
    mergedCount = sections.length - result.length;

    const splitResult = this.splitLargeSections(result);
    result = splitResult.sections;
    splitCount = splitResult.splitCount;

    result = this.reorderByPriority(result);
    result = this.adjustLevels(result);

    return {
      sections: result,
      mergedCount,
      splitCount,
      reorganized: mergedCount > 0 || splitCount > 0,
    };
  }

  mergeSections(sections: DocumentSection[]): DocumentSection {
    if (sections.length === 0) {
      throw new Error('Cannot merge empty sections array');
    }

    if (sections.length === 1) {
      return sections[0];
    }

    const merged: DocumentSection = {
      id: `merged-${sections[0].id}`,
      title: this.generateMergedTitle(sections),
      type: sections[0].type,
      priority: Math.min(...sections.map((s) => s.priority)),
      level: Math.min(...sections.map((s) => s.level)),
      children: sections.flatMap((s) => s.children),
      metadata: {
        tags: [...new Set(sections.flatMap((s) => s.metadata.tags))],
        category: sections[0].metadata.category,
      },
      sourceFiles: [...new Set(sections.flatMap((s) => s.sourceFiles))],
      symbols: [...new Set(sections.flatMap((s) => s.symbols))],
    };

    if (sections.every((s) => s.content)) {
      merged.content = sections.map((s) => s.content).join('\n\n---\n\n');
    }

    return merged;
  }

  splitSection(section: DocumentSection): DocumentSection[] {
    if (!section.content || section.content.length <= this.options.splitThreshold) {
      return [section];
    }

    const parts = this.splitContent(section.content);
    const splitSections: DocumentSection[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const splitSection: DocumentSection = {
        id: `${section.id}-${i + 1}`,
        title: i === 0 ? section.title : `${section.title} (Part ${i + 1})`,
        type: section.type,
        priority: section.priority,
        level: section.level,
        content: part,
        children: [],
        metadata: {
          ...section.metadata,
          tags: [...section.metadata.tags, 'split'],
        },
        sourceFiles: section.sourceFiles,
        symbols: section.symbols,
      };
      splitSections.push(splitSection);
    }

    return splitSections;
  }

  private mergeSmallSections(sections: DocumentSection[]): DocumentSection[] {
    const result: DocumentSection[] = [];
    const mergeCandidates: DocumentSection[] = [];

    for (const section of sections) {
      const contentLength = section.content?.length || 0;

      if (contentLength < this.options.mergeThreshold && section.children.length === 0) {
        mergeCandidates.push(section);
      } else {
        if (mergeCandidates.length > 0) {
          if (mergeCandidates.length >= 2) {
            result.push(this.mergeSections(mergeCandidates));
          } else {
            result.push(...mergeCandidates);
          }
          mergeCandidates.length = 0;
        }
        result.push(section);
      }
    }

    if (mergeCandidates.length > 0) {
      if (mergeCandidates.length >= 2) {
        result.push(this.mergeSections(mergeCandidates));
      } else {
        result.push(...mergeCandidates);
      }
    }

    return result.map((section) => ({
      ...section,
      children: this.mergeSmallSections(section.children),
    }));
  }

  private splitLargeSections(sections: DocumentSection[]): {
    sections: DocumentSection[];
    splitCount: number;
  } {
    const result: DocumentSection[] = [];
    let splitCount = 0;

    for (const section of sections) {
      const contentLength = section.content?.length || 0;

      if (contentLength > this.options.splitThreshold) {
        const splitParts = this.splitSection(section);
        result.push(...splitParts);
        splitCount += splitParts.length - 1;
      } else {
        const processedChildren = this.splitLargeSections(section.children);
        result.push({
          ...section,
          children: processedChildren.sections,
        });
        splitCount += processedChildren.splitCount;
      }
    }

    return { sections: result, splitCount };
  }

  private reorderByPriority(sections: DocumentSection[]): DocumentSection[] {
    return sections
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return this.getTypeOrder(a.type) - this.getTypeOrder(b.type);
      })
      .map((section) => ({
        ...section,
        children: this.reorderByPriority(section.children),
      }));
  }

  private adjustLevels(sections: DocumentSection[], baseLevel: number = 1): DocumentSection[] {
    return sections.map((section) => {
      const adjustedSection: DocumentSection = {
        ...section,
        level: baseLevel,
        children: this.adjustLevels(section.children, baseLevel + 1),
      };
      return adjustedSection;
    });
  }

  private generateMergedTitle(sections: DocumentSection[]): string {
    if (sections.length === 0) return 'Merged Section';

    const firstTitle = sections[0].title;
    const allSameType = sections.every((s) => s.type === sections[0].type);

    if (allSameType) {
      return `${sections[0].type.charAt(0).toUpperCase() + sections[0].type.slice(1)}s`;
    }

    return firstTitle;
  }

  private splitContent(content: string): string[] {
    const parts: string[] = [];
    const sections = content.split(/\n## /);

    if (sections.length <= 1) {
      const chunkSize = this.options.splitThreshold;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > chunkSize * 0.8 && i + chunkSize < content.length) {
          parts.push(content.slice(i, i + lastNewline));
          i += lastNewline - chunkSize;
        } else {
          parts.push(chunk);
        }
      }
    } else {
      let currentPart = sections[0];
      for (let i = 1; i < sections.length; i++) {
        const section = '\n## ' + sections[i];
        if (currentPart.length + section.length > this.options.splitThreshold) {
          parts.push(currentPart.trim());
          currentPart = section;
        } else {
          currentPart += section;
        }
      }
      if (currentPart.trim()) {
        parts.push(currentPart.trim());
      }
    }

    return parts.length > 0 ? parts : [content];
  }

  private getTypeOrder(type: SectionType): number {
    const order: Record<SectionType, number> = {
      [SectionType.Overview]: 1,
      [SectionType.Architecture]: 2,
      [SectionType.Guide]: 3,
      [SectionType.Module]: 4,
      [SectionType.API]: 5,
      [SectionType.Reference]: 6,
      [SectionType.Example]: 7,
      [SectionType.Config]: 8,
      [SectionType.Decision]: 9,
      [SectionType.Test]: 10,
      [SectionType.Changelog]: 11,
      [SectionType.Contributing]: 12,
      [SectionType.Custom]: 13,
    };
    return order[type] || 99;
  }

  setOptions(options: Partial<ContentOrganizationOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
