import * as crypto from 'crypto';
import { WikiPage, WikiSection, WikiPageMetadata } from '../types';
import {
  PageUpdatePlan,
  PageUpdateType,
  ContentMergeStrategy,
  SectionUpdatePlan,
  SymbolChange,
  PageContentDiff,
  SectionDiff,
  DiffLine,
  PAGE_UPDATE_RULES,
} from './types';

export class PageUpdater {

  analyzePageUpdate(
    page: WikiPage,
    changedFiles: string[],
    symbolChanges: SymbolChange[]
  ): PageUpdatePlan {
    const pageCategory = page.metadata.category;
    const rules = PAGE_UPDATE_RULES[pageCategory as keyof typeof PAGE_UPDATE_RULES];

    const affectedSymbols = this.getAffectedSymbolsForPage(page, symbolChanges);
    const affectedFiles = this.getAffectedFilesForPage(page, changedFiles);

    const updateType = this.determineUpdateType(page, affectedSymbols, affectedFiles);
    const mergeStrategy = rules?.mergeStrategy || 'smart-merge';
    const sectionsToUpdate = this.planSectionUpdates(page, affectedSymbols, affectedFiles);

    return {
      pageId: page.id,
      pageTitle: page.title,
      updateType,
      mergeStrategy,
      sectionsToUpdate,
      preserveContent: updateType !== 'regenerate',
      reason: this.generateUpdateReason(updateType, affectedSymbols, affectedFiles),
    };
  }

  mergePageContent(
    oldPage: WikiPage,
    newContent: string,
    strategy: ContentMergeStrategy,
    sectionsToUpdate: SectionUpdatePlan[]
  ): WikiPage {
    switch (strategy) {
      case 'replace-sections':
        return this.replaceSections(oldPage, newContent, sectionsToUpdate);
      case 'append-new':
        return this.appendNewContent(oldPage, newContent);
      case 'smart-merge':
        return this.smartMerge(oldPage, newContent, sectionsToUpdate);
      case 'symbol-level':
        return this.symbolLevelMerge(oldPage, newContent, sectionsToUpdate);
      default:
        return oldPage;
    }
  }

  computeContentDiff(oldContent: string, newContent: string): PageContentDiff {
    const oldSections = this.extractSections(oldContent);
    const newSections = this.extractSections(newContent);

    const oldSectionMap = new Map(oldSections.map(s => [s.title, s]));
    const newSectionMap = new Map(newSections.map(s => [s.title, s]));

    const addedSections: string[] = [];
    const deletedSections: string[] = [];
    const unchangedSections: string[] = [];
    const modifiedSections: SectionDiff[] = [];

    for (const [title] of newSectionMap) {
      if (!oldSectionMap.has(title)) {
        addedSections.push(title);
      }
    }

    for (const [title] of oldSectionMap) {
      if (!newSectionMap.has(title)) {
        deletedSections.push(title);
      }
    }

    for (const [title, newSection] of newSectionMap) {
      const oldSection = oldSectionMap.get(title);
      if (oldSection) {
        const contentChanged = oldSection.content.trim() !== newSection.content.trim();
        if (contentChanged) {
          const diffLines = this.computeLineDiff(oldSection.content, newSection.content);
          modifiedSections.push({
            sectionId: oldSection.id,
            sectionTitle: title,
            oldContent: oldSection.content,
            newContent: newSection.content,
            diffLines,
          });
        } else {
          unchangedSections.push(title);
        }
      }
    }

    return {
      pageId: '',
      addedSections,
      modifiedSections,
      deletedSections,
      unchangedSections,
    };
  }

  computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  updatePageMetadata(
    page: WikiPage,
    sourceFiles: string[],
    commitHash?: string
  ): WikiPageMetadata {
    return {
      ...page.metadata,
      sourceFiles,
      commitHash,
      custom: {
        ...page.metadata.custom,
        lastIncrementalUpdate: new Date().toISOString(),
      },
    };
  }

  private getAffectedSymbolsForPage(
    page: WikiPage,
    symbolChanges: SymbolChange[]
  ): SymbolChange[] {
    const pageSourceFiles = new Set(page.metadata.sourceFiles);
    return symbolChanges.filter(change => pageSourceFiles.has(change.filePath));
  }

  private getAffectedFilesForPage(page: WikiPage, changedFiles: string[]): string[] {
    const pageSourceFiles = new Set(page.metadata.sourceFiles);
    return changedFiles.filter(file => pageSourceFiles.has(file));
  }

  private determineUpdateType(
    page: WikiPage,
    affectedSymbols: SymbolChange[],
    affectedFiles: string[]
  ): PageUpdateType {
    if (affectedFiles.length === 0 && affectedSymbols.length === 0) {
      return 'skip';
    }

    const deletedCount = affectedSymbols.filter(s => s.changeType === 'deleted').length;
    const totalSymbols = this.estimateTotalSymbols(page);

    if (deletedCount > totalSymbols * 0.5) {
      return 'regenerate';
    }

    if (affectedSymbols.length > 10 || affectedFiles.length > 5) {
      return 'merge';
    }

    return 'partial-update';
  }

  private estimateTotalSymbols(page: WikiPage): number {
    const symbolPatterns = [
      /\*\*Classes\*\*/g,
      /\*\*Interfaces\*\*/g,
      /\*\*Functions\*\*/g,
      /###\s+\w+/g,
    ];

    let count = 0;
    for (const pattern of symbolPatterns) {
      const matches = page.content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return Math.max(count, 10);
  }

  private planSectionUpdates(
    page: WikiPage,
    affectedSymbols: SymbolChange[],
    affectedFiles: string[]
  ): SectionUpdatePlan[] {
    const sections: SectionUpdatePlan[] = [];
    const pageSections = page.sections;

    for (const section of pageSections) {
      const isAffected = this.isSectionAffected(section, affectedSymbols, affectedFiles);
      if (isAffected) {
        sections.push({
          sectionId: section.id,
          sectionTitle: section.title,
          action: 'replace',
        });
      }
    }

    return sections;
  }

  private isSectionAffected(
    section: WikiSection,
    affectedSymbols: SymbolChange[],
    affectedFiles: string[]
  ): boolean {
    const sectionContent = section.content.toLowerCase();

    for (const symbol of affectedSymbols) {
      if (sectionContent.includes(symbol.symbolName.toLowerCase())) {
        return true;
      }
    }

    for (const file of affectedFiles) {
      const fileName = file.split('/').pop()?.toLowerCase() || '';
      if (sectionContent.includes(fileName)) {
        return true;
      }
    }

    return false;
  }

  private generateUpdateReason(
    updateType: PageUpdateType,
    affectedSymbols: SymbolChange[],
    affectedFiles: string[]
  ): string {
    if (updateType === 'skip') {
      return 'No changes detected';
    }

    const parts: string[] = [];

    if (affectedFiles.length > 0) {
      parts.push(`${affectedFiles.length} file(s) changed`);
    }

    if (affectedSymbols.length > 0) {
      const added = affectedSymbols.filter(s => s.changeType === 'added').length;
      const modified = affectedSymbols.filter(s => s.changeType === 'modified').length;
      const deleted = affectedSymbols.filter(s => s.changeType === 'deleted').length;

      if (added > 0) parts.push(`${added} symbol(s) added`);
      if (modified > 0) parts.push(`${modified} symbol(s) modified`);
      if (deleted > 0) parts.push(`${deleted} symbol(s) deleted`);
    }

    return parts.join(', ') || 'Changes detected';
  }

  private replaceSections(
    oldPage: WikiPage,
    newContent: string,
    sectionsToUpdate: SectionUpdatePlan[]
  ): WikiPage {
    let content = oldPage.content;
    const newSections = this.extractSections(newContent);
    const newSectionMap = new Map(newSections.map(s => [s.title, s]));

    for (const updatePlan of sectionsToUpdate) {
      const newSection = newSectionMap.get(updatePlan.sectionTitle);
      if (newSection) {
        const sectionPattern = new RegExp(
          `(## ${this.escapeRegExp(updatePlan.sectionTitle)}[\\s\\S]*?)(?=## |$)`,
          'g'
        );
        content = content.replace(sectionPattern, newSection.content + '\n\n');
      }
    }

    return {
      ...oldPage,
      content,
      updatedAt: new Date(),
      version: oldPage.version + 1,
    };
  }

  private appendNewContent(oldPage: WikiPage, newContent: string): WikiPage {
    const oldSections = this.extractSections(oldPage.content);
    const newSections = this.extractSections(newContent);

    const oldTitles = new Set(oldSections.map(s => s.title));
    const sectionsToAppend = newSections.filter(s => !oldTitles.has(s.title));

    let content = oldPage.content;
    for (const section of sectionsToAppend) {
      content += '\n\n' + section.content;
    }

    return {
      ...oldPage,
      content,
      updatedAt: new Date(),
      version: oldPage.version + 1,
    };
  }

  private smartMerge(
    oldPage: WikiPage,
    newContent: string,
    sectionsToUpdate: SectionUpdatePlan[]
  ): WikiPage {
    const oldSections = this.extractSections(oldPage.content);
    const newSections = this.extractSections(newContent);

    const mergedSections: WikiSection[] = [];
    const newSectionMap = new Map(newSections.map(s => [s.title, s]));
    const updateSet = new Set(sectionsToUpdate.map(s => s.sectionTitle));

    const processedTitles = new Set<string>();

    for (const oldSection of oldSections) {
      if (updateSet.has(oldSection.title) && newSectionMap.has(oldSection.title)) {
        mergedSections.push(newSectionMap.get(oldSection.title)!);
      } else {
        mergedSections.push(oldSection);
      }
      processedTitles.add(oldSection.title);
    }

    for (const newSection of newSections) {
      if (!processedTitles.has(newSection.title)) {
        mergedSections.push(newSection);
      }
    }

    mergedSections.sort((a, b) => a.order - b.order);

    const content = mergedSections.map(s => s.content).join('\n\n');

    return {
      ...oldPage,
      content,
      sections: mergedSections,
      updatedAt: new Date(),
      version: oldPage.version + 1,
    };
  }

  private symbolLevelMerge(
    oldPage: WikiPage,
    newContent: string,
    _sectionsToUpdate: SectionUpdatePlan[]
  ): WikiPage {
    let content = oldPage.content;

    const oldSymbols = this.extractSymbolsFromContent(oldPage.content);
    const newSymbols = this.extractSymbolsFromContent(newContent);

    for (const [symbolName, newSymbolContent] of newSymbols) {
      if (oldSymbols.has(symbolName)) {
        const oldSymbolContent = oldSymbols.get(symbolName);
        if (oldSymbolContent !== newSymbolContent) {
          content = content.replace(
            this.createSymbolPattern(symbolName),
            newSymbolContent
          );
        }
      } else {
        const insertPoint = this.findInsertPoint(content, symbolName);
        if (insertPoint) {
          content = content.slice(0, insertPoint) + '\n\n' + newSymbolContent + content.slice(insertPoint);
        } else {
          content += '\n\n' + newSymbolContent;
        }
      }
    }

    return {
      ...oldPage,
      content,
      updatedAt: new Date(),
      version: oldPage.version + 1,
    };
  }

  private extractSections(content: string): WikiSection[] {
    const sections: WikiSection[] = [];
    const pattern = /^(#{1,6}) (.+)$/gm;
    let match;
    let order = 0;
    const matches: { level: number; title: string; index: number }[] = [];

    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        level: match[1].length,
        title: match[2].trim(),
        index: match.index,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
      const sectionContent = content.slice(start, end).trim();

      sections.push({
        id: `section-${order}`,
        title: matches[i].title,
        content: sectionContent,
        level: matches[i].level,
        order: order++,
      });
    }

    return sections;
  }

  private computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffLines: DiffLine[] = [];

    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let lineNumber = 1;
    for (const line of oldLines) {
      if (!newSet.has(line)) {
        diffLines.push({ type: 'removed', content: line, lineNumber: lineNumber++ });
      } else {
        diffLines.push({ type: 'unchanged', content: line, lineNumber: lineNumber++ });
      }
    }

    lineNumber = 1;
    for (const line of newLines) {
      if (!oldSet.has(line)) {
        diffLines.push({ type: 'added', content: line, lineNumber: lineNumber++ });
      }
    }

    return diffLines.sort((a, b) => a.lineNumber - b.lineNumber);
  }

  private extractSymbolsFromContent(content: string): Map<string, string> {
    const symbols = new Map<string, string>();
    const pattern = /### `?(\w+)`?\n([\s\S]*?)(?=### |$)/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      symbols.set(match[1], match[0].trim());
    }

    return symbols;
  }

  private createSymbolPattern(symbolName: string): RegExp {
    const escapedName = this.escapeRegExp(symbolName);
    return new RegExp(
      `### \`${escapedName}\`\\n[\\s\\S]*?(?=### |$)`,
      'g'
    );
  }

  private findInsertPoint(content: string, _symbolName: string): number | null {
    const lastSectionMatch = content.match(/### .+\n[\s\S]*$/);
    if (lastSectionMatch && lastSectionMatch.index !== undefined) {
      return lastSectionMatch.index + lastSectionMatch[0].length;
    }
    return null;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
