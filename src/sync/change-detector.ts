import * as crypto from 'crypto';
import { ParsedFile, CodeSymbol } from '../types';
import { IChangeDetector, ChangeSet, FileChange, ChangeType, ChangeSummary } from './types';

export class ChangeDetector implements IChangeDetector {
  detect(oldFiles: ParsedFile[], newFiles: ParsedFile[]): ChangeSet {
    const changes: FileChange[] = [];
    const oldFileMap = new Map<string, ParsedFile>();
    const newFileMap = new Map<string, ParsedFile>();

    for (const file of oldFiles) {
      oldFileMap.set(file.path, file);
    }

    for (const file of newFiles) {
      newFileMap.set(file.path, file);
    }

    for (const [path, newFile] of newFileMap) {
      const oldFile = oldFileMap.get(path);

      if (!oldFile) {
        changes.push(this.createFileChange(null, newFile, 'added'));
      } else {
        const change = this.detectFileChange(oldFile, newFile);
        if (change) {
          changes.push(change);
        }
      }
    }

    for (const [path, oldFile] of oldFileMap) {
      if (!newFileMap.has(path)) {
        changes.push(this.createFileChange(oldFile, null, 'deleted'));
      }
    }

    const summary = this.calculateSummary(changes);

    return {
      files: changes,
      timestamp: new Date(),
      baseCommit: '',
      headCommit: '',
      summary,
    };
  }

  detectFileChange(oldFile: ParsedFile | null, newFile: ParsedFile | null): FileChange | null {
    if (!oldFile && !newFile) return null;

    if (!oldFile) {
      return this.createFileChange(null, newFile!, 'added');
    }

    if (!newFile) {
      return this.createFileChange(oldFile, null, 'deleted');
    }

    const oldHash = this.computeFileHash(oldFile);
    const newHash = this.computeFileHash(newFile);

    if (oldHash === newHash) {
      return null;
    }

    const symbolChanges = this.compareSymbols(oldFile.symbols, newFile.symbols);

    const hasSymbolChanges =
      symbolChanges.added.length > 0 ||
      symbolChanges.modified.length > 0 ||
      symbolChanges.deleted.length > 0;

    if (!hasSymbolChanges && oldFile.rawContent === newFile.rawContent) {
      return null;
    }

    return {
      path: newFile.path,
      changeType: 'modified',
      oldContent: oldFile.rawContent,
      newContent: newFile.rawContent,
      symbols: symbolChanges,
    };
  }

  compareSymbols(
    oldSymbols: CodeSymbol[],
    newSymbols: CodeSymbol[]
  ): { added: CodeSymbol[]; modified: CodeSymbol[]; deleted: CodeSymbol[] } {
    const result: { added: CodeSymbol[]; modified: CodeSymbol[]; deleted: CodeSymbol[] } = {
      added: [],
      modified: [],
      deleted: [],
    };

    const oldSymbolMap = new Map<string, CodeSymbol>();
    const newSymbolMap = new Map<string, CodeSymbol>();

    for (const symbol of oldSymbols) {
      oldSymbolMap.set(this.getSymbolKey(symbol), symbol);
    }

    for (const symbol of newSymbols) {
      newSymbolMap.set(this.getSymbolKey(symbol), symbol);
    }

    for (const [key, newSymbol] of newSymbolMap) {
      const oldSymbol = oldSymbolMap.get(key);

      if (!oldSymbol) {
        result.added.push(newSymbol);
      } else {
        if (this.hasSymbolChanged(oldSymbol, newSymbol)) {
          result.modified.push(newSymbol);
        }
      }
    }

    for (const [key, oldSymbol] of oldSymbolMap) {
      if (!newSymbolMap.has(key)) {
        result.deleted.push(oldSymbol);
      }
    }

    return result;
  }

  detectRename(oldFiles: ParsedFile[], newFiles: ParsedFile[]): Map<string, string> {
    const renames = new Map<string, string>();

    const oldContentMap = new Map<string, ParsedFile>();
    for (const file of oldFiles) {
      if (file.rawContent) {
        const hash = this.computeContentHash(file.rawContent);
        oldContentMap.set(hash, file);
      }
    }

    for (const newFile of newFiles) {
      if (newFile.rawContent) {
        const hash = this.computeContentHash(newFile.rawContent);
        const oldFile = oldContentMap.get(hash);

        if (oldFile && oldFile.path !== newFile.path) {
          renames.set(oldFile.path, newFile.path);
        }
      }
    }

    return renames;
  }

  getAffectedFiles(changeSet: ChangeSet, dependencyGraph: Map<string, Set<string>>): string[] {
    const affected = new Set<string>();

    for (const change of changeSet.files) {
      affected.add(change.path);

      const dependents = dependencyGraph.get(change.path);
      if (dependents) {
        for (const dep of dependents) {
          affected.add(dep);
        }
      }
    }

    return Array.from(affected);
  }

  private createFileChange(
    oldFile: ParsedFile | null,
    newFile: ParsedFile | null,
    changeType: ChangeType
  ): FileChange {
    return {
      path: newFile?.path || oldFile?.path || '',
      oldPath: changeType === 'renamed' ? oldFile?.path : undefined,
      changeType,
      oldContent: oldFile?.rawContent,
      newContent: newFile?.rawContent,
      symbols: {
        added: changeType === 'added' ? newFile?.symbols || [] : [],
        modified: [],
        deleted: changeType === 'deleted' ? oldFile?.symbols || [] : [],
      },
    };
  }

  private computeFileHash(file: ParsedFile): string {
    const content = file.rawContent || '';
    const symbols = file.symbols.map((s) => `${s.name}:${s.kind}`).join(',');
    return this.computeContentHash(content + symbols);
  }

  private computeContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private getSymbolKey(symbol: CodeSymbol): string {
    return `${symbol.kind}:${symbol.name}`;
  }

  private hasSymbolChanged(oldSymbol: CodeSymbol, newSymbol: CodeSymbol): boolean {
    if (oldSymbol.signature !== newSymbol.signature) return true;
    if (oldSymbol.description !== newSymbol.description) return true;
    if (oldSymbol.documentation !== newSymbol.documentation) return true;

    if (JSON.stringify(oldSymbol.parameters) !== JSON.stringify(newSymbol.parameters)) {
      return true;
    }

    if (JSON.stringify(oldSymbol.members) !== JSON.stringify(newSymbol.members)) {
      return true;
    }

    if (JSON.stringify(oldSymbol.extends) !== JSON.stringify(newSymbol.extends)) {
      return true;
    }

    if (JSON.stringify(oldSymbol.implements) !== JSON.stringify(newSymbol.implements)) {
      return true;
    }

    return false;
  }

  private calculateSummary(changes: FileChange[]): ChangeSummary {
    const summary: ChangeSummary = {
      totalFiles: changes.length,
      addedFiles: 0,
      modifiedFiles: 0,
      deletedFiles: 0,
      renamedFiles: 0,
      totalSymbols: 0,
      addedSymbols: 0,
      modifiedSymbols: 0,
      deletedSymbols: 0,
    };

    for (const change of changes) {
      switch (change.changeType) {
        case 'added':
          summary.addedFiles++;
          break;
        case 'modified':
          summary.modifiedFiles++;
          break;
        case 'deleted':
          summary.deletedFiles++;
          break;
        case 'renamed':
          summary.renamedFiles++;
          break;
      }

      summary.addedSymbols += change.symbols.added.length;
      summary.modifiedSymbols += change.symbols.modified.length;
      summary.deletedSymbols += change.symbols.deleted.length;
    }

    summary.totalSymbols = summary.addedSymbols + summary.modifiedSymbols + summary.deletedSymbols;

    return summary;
  }
}
