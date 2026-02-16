import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeLink,
  CodeLinkTarget,
  FileLocation,
  SymbolLocation,
  ResolvedLocation,
  ILocationLinker,
  LocationIndexEntry,
} from './types';

export class CodeLocationLinker implements ILocationLinker {
  private links: Map<string, CodeLink> = new Map();
  private pageIndex: Map<string, Set<string>> = new Map();
  private fileIndex: Map<string, Set<string>> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map();
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async createLink(
    pageId: string,
    target: CodeLinkTarget,
    displayText?: string,
    sectionId?: string
  ): Promise<CodeLink> {
    const id = this.generateId();
    const link: CodeLink = {
      id,
      pageId,
      sectionId,
      target,
      displayText: displayText || this.generateDisplayText(target),
      createdAt: new Date(),
    };

    this.links.set(id, link);
    this.updateIndices(link, 'add');

    return link;
  }

  async resolveLink(link: CodeLink): Promise<ResolvedLocation> {
    const target = link.target;
    const filePath = this.resolveFilePath(target.filePath);

    if (this.isSymbolLocation(target)) {
      return this.resolveSymbolLocation(target, filePath);
    }

    return this.resolveFileLocation(target, filePath);
  }

  async updateLinks(pageId: string, links: CodeLink[]): Promise<void> {
    const existingLinks = await this.getLinksByPage(pageId);
    for (const link of existingLinks) {
      await this.removeLink(link.id);
    }

    for (const link of links) {
      this.links.set(link.id, link);
      this.updateIndices(link, 'add');
    }
  }

  async getLinksByPage(pageId: string): Promise<CodeLink[]> {
    const linkIds = this.pageIndex.get(pageId) || new Set();
    const links: CodeLink[] = [];

    for (const id of linkIds) {
      const link = this.links.get(id);
      if (link) {
        links.push(link);
      }
    }

    return links.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getLinksByFile(filePath: string): Promise<CodeLink[]> {
    const normalizedPath = this.normalizePath(filePath);
    const linkIds = this.fileIndex.get(normalizedPath) || new Set();
    const links: CodeLink[] = [];

    for (const id of linkIds) {
      const link = this.links.get(id);
      if (link) {
        links.push(link);
      }
    }

    return links;
  }

  async getLinksBySymbol(symbolName: string): Promise<CodeLink[]> {
    const linkIds = this.symbolIndex.get(symbolName) || new Set();
    const links: CodeLink[] = [];

    for (const id of linkIds) {
      const link = this.links.get(id);
      if (link) {
        links.push(link);
      }
    }

    return links;
  }

  async removeLink(linkId: string): Promise<boolean> {
    const link = this.links.get(linkId);
    if (!link) {
      return false;
    }

    this.updateIndices(link, 'remove');
    return this.links.delete(linkId);
  }

  createLocationEntry(link: CodeLink): LocationIndexEntry {
    const target = link.target;
    return {
      linkId: link.id,
      filePath: target.filePath,
      range: target.range,
      symbolName: this.isSymbolLocation(target) ? target.symbolName : undefined,
      symbolKind: this.isSymbolLocation(target) ? target.kind : undefined,
      pageId: link.pageId,
      sectionId: link.sectionId,
    };
  }

  getLinkById(id: string): CodeLink | null {
    return this.links.get(id) || null;
  }

  getAllLinks(): CodeLink[] {
    return Array.from(this.links.values());
  }

  clear(): void {
    this.links.clear();
    this.pageIndex.clear();
    this.fileIndex.clear();
    this.symbolIndex.clear();
  }

  private isSymbolLocation(target: CodeLinkTarget): target is SymbolLocation {
    return 'symbolName' in target;
  }

  private resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.projectPath, filePath);
  }

  private async resolveSymbolLocation(
    target: SymbolLocation,
    filePath: string
  ): Promise<ResolvedLocation> {
    const exists = fs.existsSync(filePath);

    return {
      type: 'symbol',
      filePath,
      range: target.range,
      symbolName: target.symbolName,
      symbolKind: target.kind,
      exists,
    };
  }

  private async resolveFileLocation(
    target: FileLocation,
    filePath: string
  ): Promise<ResolvedLocation> {
    const exists = fs.existsSync(filePath);

    return {
      type: 'file',
      filePath,
      range: target.range,
      exists,
    };
  }

  private updateIndices(link: CodeLink, operation: 'add' | 'remove'): void {
    const updateSet = (map: Map<string, Set<string>>, key: string, id: string) => {
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      if (operation === 'add') {
        map.get(key)!.add(id);
      } else {
        map.get(key)!.delete(id);
      }
    };

    updateSet(this.pageIndex, link.pageId, link.id);

    const filePath = this.normalizePath(link.target.filePath);
    updateSet(this.fileIndex, filePath, link.id);

    if (this.isSymbolLocation(link.target)) {
      updateSet(this.symbolIndex, link.target.symbolName, link.id);
    }
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  private generateDisplayText(target: CodeLinkTarget): string {
    if (this.isSymbolLocation(target)) {
      return `${target.symbolName} (${target.kind})`;
    }
    return path.basename(target.filePath);
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}
