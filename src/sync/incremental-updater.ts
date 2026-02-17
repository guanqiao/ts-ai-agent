import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedFile } from '../types';
import {
  IIncrementalUpdater,
  ChangeSet,
  ChangeType,
  Snapshot,
  SnapshotFile,
  SnapshotMetadata,
} from './types';
import { SnapshotIndex } from './snapshot-index';

export class IncrementalUpdater implements IIncrementalUpdater {
  private snapshotDir: string;
  private snapshotIndex: SnapshotIndex;

  constructor(snapshotDir: string = '.wiki-snapshots', maxSnapshots: number = 10) {
    this.snapshotDir = snapshotDir;
    this.snapshotIndex = new SnapshotIndex(snapshotDir, maxSnapshots);
  }

  async update(changeSet: ChangeSet, existingDocument: string): Promise<string> {
    if (changeSet.files.length === 0) {
      return existingDocument;
    }

    let updatedDocument = existingDocument;

    for (const fileChange of changeSet.files) {
      updatedDocument = await this.applyFileChange(updatedDocument, fileChange);
    }

    updatedDocument = this.updateTimestamp(updatedDocument, changeSet.timestamp);

    return updatedDocument;
  }

  mergeContent(oldContent: string, newContent: string, changeType: ChangeType): string {
    switch (changeType) {
      case 'added':
        return this.mergeAddedContent(oldContent, newContent);
      case 'modified':
        return this.mergeModifiedContent(oldContent, newContent);
      case 'deleted':
        return this.mergeDeletedContent(oldContent, newContent);
      case 'renamed':
        return this.mergeRenamedContent(oldContent, newContent);
      default:
        return oldContent;
    }
  }

  createSnapshot(files: ParsedFile[], commitHash: string): Snapshot {
    const snapshotFiles: SnapshotFile[] = files.map((file) => ({
      path: file.path,
      hash: this.computeFileHash(file),
      symbolCount: file.symbols.length,
      lastModified: new Date(),
    }));

    const metadata: SnapshotMetadata = {
      totalFiles: files.length,
      totalSymbols: files.reduce((sum, f) => sum + f.symbols.length, 0),
      generator: 'tsd-generator',
      version: '1.0.0',
    };

    return {
      id: this.generateSnapshotId(commitHash),
      timestamp: new Date(),
      commitHash,
      files: snapshotFiles,
      metadata,
    };
  }

  async loadSnapshot(snapshotId: string): Promise<Snapshot | null> {
    const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);

    try {
      const content = await fs.promises.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content) as Snapshot;
      snapshot.timestamp = new Date(snapshot.timestamp);
      snapshot.files = snapshot.files.map((f) => ({
        ...f,
        lastModified: new Date(f.lastModified),
      }));
      return snapshot;
    } catch {
      return null;
    }
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    if (!fs.existsSync(this.snapshotDir)) {
      await fs.promises.mkdir(this.snapshotDir, { recursive: true });
    }

    const snapshotPath = path.join(this.snapshotDir, `${snapshot.id}.json`);
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    this.snapshotIndex.addSnapshot(snapshot);

    await this.cleanupOldSnapshots();
  }

  async getLatestSnapshot(): Promise<Snapshot | null> {
    const latestId = this.snapshotIndex.getLatestSnapshotId();
    if (latestId) {
      return this.loadSnapshot(latestId);
    }

    if (!fs.existsSync(this.snapshotDir)) {
      return null;
    }

    const files = await fs.promises.readdir(this.snapshotDir);
    const snapshotFiles = files.filter((f) => f.endsWith('.json') && f !== 'snapshot-index.json');

    if (snapshotFiles.length === 0) {
      return null;
    }

    const snapshots: Snapshot[] = [];
    for (const file of snapshotFiles) {
      const snapshotId = file.replace('.json', '');
      const snapshot = await this.loadSnapshot(snapshotId);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (snapshots.length > 0) {
      this.snapshotIndex.addSnapshot(snapshots[0]);
    }

    return snapshots[0] || null;
  }

  async detectChangesSinceLastSnapshot(
    currentFiles: ParsedFile[]
  ): Promise<{ hasChanges: boolean; changePercentage: number }> {
    const lastSnapshot = await this.getLatestSnapshot();

    if (!lastSnapshot) {
      return { hasChanges: true, changePercentage: 100 };
    }

    const currentFileMap = new Map<string, ParsedFile>();
    for (const file of currentFiles) {
      currentFileMap.set(file.path, file);
    }

    let changedFiles = 0;
    let totalFiles = lastSnapshot.files.length;

    for (const snapshotFile of lastSnapshot.files) {
      const currentFile = currentFileMap.get(snapshotFile.path);

      if (!currentFile) {
        changedFiles++;
      } else {
        const currentHash = this.computeFileHash(currentFile);
        if (currentHash !== snapshotFile.hash) {
          changedFiles++;
        }
      }
    }

    for (const [path] of currentFileMap) {
      if (!lastSnapshot.files.some((f) => f.path === path)) {
        changedFiles++;
        totalFiles++;
      }
    }

    const changePercentage = totalFiles > 0 ? (changedFiles / totalFiles) * 100 : 0;

    return {
      hasChanges: changedFiles > 0,
      changePercentage,
    };
  }

  private async applyFileChange(
    document: string,
    fileChange: { path: string; changeType: ChangeType; newContent?: string }
  ): Promise<string> {
    const fileName = path.basename(fileChange.path);
    const sectionPattern = new RegExp(`## ${this.escapeRegExp(fileName)}[\\s\\S]*?(?=## |$)`, 'g');

    switch (fileChange.changeType) {
      case 'added':
      case 'modified':
        return document;

      case 'deleted':
        return document.replace(sectionPattern, '');

      case 'renamed':
        return document;

      default:
        return document;
    }
  }

  private mergeAddedContent(oldContent: string, newContent: string): string {
    const sections = this.extractSections(oldContent);
    const newSection = this.extractFirstSection(newContent);

    if (newSection) {
      sections.push(newSection);
      return this.rebuildDocument(sections);
    }

    return oldContent + '\n\n' + newContent;
  }

  private mergeModifiedContent(oldContent: string, newContent: string): string {
    const oldSections = this.extractSections(oldContent);
    const newSections = this.extractSections(newContent);

    const mergedSections = new Map<string, string>();

    for (const section of oldSections) {
      const title = this.extractSectionTitle(section);
      if (title) {
        mergedSections.set(title, section);
      }
    }

    for (const section of newSections) {
      const title = this.extractSectionTitle(section);
      if (title) {
        mergedSections.set(title, section);
      }
    }

    return this.rebuildDocument(Array.from(mergedSections.values()));
  }

  private mergeDeletedContent(oldContent: string, newContent: string): string {
    const oldSections = this.extractSections(oldContent);
    const newSections = this.extractSections(newContent);

    const newTitles = new Set<string>();
    for (const section of newSections) {
      const title = this.extractSectionTitle(section);
      if (title) {
        newTitles.add(title);
      }
    }

    const remainingSections = oldSections.filter((section) => {
      const title = this.extractSectionTitle(section);
      return title && !newTitles.has(title);
    });

    return this.rebuildDocument(remainingSections);
  }

  private mergeRenamedContent(oldContent: string, newContent: string): string {
    return this.mergeModifiedContent(oldContent, newContent);
  }

  private updateTimestamp(document: string, timestamp: Date): string {
    const timestampPattern = /\*Last updated:.*?\*/i;
    const newTimestamp = `*Last updated: ${timestamp.toISOString()}*`;

    if (timestampPattern.test(document)) {
      return document.replace(timestampPattern, newTimestamp);
    }

    return document + '\n\n---\n\n' + newTimestamp;
  }

  private extractSections(content: string): string[] {
    const sectionPattern = /^## .+/gm;
    const sections: string[] = [];

    let match: RegExpExecArray | null;

    const tempPattern = new RegExp(sectionPattern.source, 'gm');
    const matches: { index: number; text: string }[] = [];

    while ((match = tempPattern.exec(content)) !== null) {
      matches.push({ index: match.index, text: match[0] });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
      sections.push(content.slice(start, end).trim());
    }

    if (matches.length === 0 && content.trim()) {
      sections.push(content.trim());
    }

    return sections;
  }

  private extractFirstSection(content: string): string | null {
    const sections = this.extractSections(content);
    return sections[0] || null;
  }

  private extractSectionTitle(section: string): string | null {
    const match = section.match(/^## (.+)/);
    return match ? match[1].trim() : null;
  }

  private rebuildDocument(sections: string[]): string {
    return sections.join('\n\n');
  }

  private computeFileHash(file: ParsedFile): string {
    const content = file.rawContent || '';
    const symbols = file.symbols.map((s) => `${s.name}:${s.kind}`).join(',');
    return crypto
      .createHash('md5')
      .update(content + symbols)
      .digest('hex');
  }

  private generateSnapshotId(commitHash: string): string {
    const timestamp = Date.now();
    return `snapshot-${commitHash.substring(0, 7)}-${timestamp}`;
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const idsToDelete = this.snapshotIndex.getSnapshotIdsToDelete();

    for (const snapshotId of idsToDelete) {
      const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);
      try {
        await fs.promises.unlink(snapshotPath);
        this.snapshotIndex.removeSnapshot(snapshotId);
      } catch {
        // File may not exist
      }
    }
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async getChangedFilesSinceLastSnapshot(currentFiles: ParsedFile[]): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
  }> {
    const lastSnapshot = await this.getLatestSnapshot();

    if (!lastSnapshot) {
      return {
        added: currentFiles.map(f => f.path),
        modified: [],
        deleted: [],
      };
    }

    const snapshotFileMap = new Map<string, string>();
    for (const file of lastSnapshot.files) {
      snapshotFileMap.set(file.path, file.hash);
    }

    const currentFileMap = new Map<string, ParsedFile>();
    for (const file of currentFiles) {
      currentFileMap.set(file.path, file);
    }

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const [path] of snapshotFileMap) {
      if (!currentFileMap.has(path)) {
        deleted.push(path);
      }
    }

    for (const [path, file] of currentFileMap) {
      const oldHash = snapshotFileMap.get(path);
      if (!oldHash) {
        added.push(path);
      } else {
        const currentHash = this.computeFileHash(file);
        if (currentHash !== oldHash) {
          modified.push(path);
        }
      }
    }

    return { added, modified, deleted };
  }

  createEnhancedSnapshot(
    files: ParsedFile[],
    commitHash: string,
    pageFileMap?: Map<string, Set<string>>
  ): Snapshot & { pageFileMap?: Record<string, string[]> } {
    const baseSnapshot = this.createSnapshot(files, commitHash);

    if (pageFileMap) {
      const pageFileMapRecord: Record<string, string[]> = {};
      for (const [pageId, filePaths] of pageFileMap) {
        pageFileMapRecord[pageId] = Array.from(filePaths);
      }
      return {
        ...baseSnapshot,
        pageFileMap: pageFileMapRecord,
      };
    }

    return baseSnapshot;
  }

  async saveEnhancedSnapshot(
    snapshot: Snapshot & { pageFileMap?: Record<string, string[]> }
  ): Promise<void> {
    if (!fs.existsSync(this.snapshotDir)) {
      await fs.promises.mkdir(this.snapshotDir, { recursive: true });
    }

    const snapshotPath = path.join(this.snapshotDir, `${snapshot.id}.json`);
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    await this.cleanupOldSnapshots();
  }

  async loadEnhancedSnapshot(
    snapshotId: string
  ): Promise<(Snapshot & { pageFileMap?: Record<string, string[]> }) | null> {
    const snapshot = await this.loadSnapshot(snapshotId);
    if (!snapshot) {
      return null;
    }

    const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);
    try {
      const content = await fs.promises.readFile(snapshotPath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        ...snapshot,
        pageFileMap: parsed.pageFileMap,
      };
    } catch {
      return snapshot;
    }
  }

  async getLatestEnhancedSnapshot(): Promise<(Snapshot & { pageFileMap?: Record<string, string[]> }) | null> {
    const latestSnapshot = await this.getLatestSnapshot();
    if (!latestSnapshot) {
      return null;
    }

    return this.loadEnhancedSnapshot(latestSnapshot.id);
  }

  async getAffectedPages(changedFiles: string[]): Promise<string[]> {
    const enhancedSnapshot = await this.getLatestEnhancedSnapshot();
    if (!enhancedSnapshot || !enhancedSnapshot.pageFileMap) {
      return [];
    }

    const affectedPages = new Set<string>();
    const changedFilesSet = new Set(changedFiles);

    for (const [pageId, sourceFiles] of Object.entries(enhancedSnapshot.pageFileMap)) {
      for (const sourceFile of sourceFiles) {
        if (changedFilesSet.has(sourceFile)) {
          affectedPages.add(pageId);
          break;
        }
      }
    }

    return Array.from(affectedPages);
  }

  computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
