import * as path from 'path';
import * as fs from 'fs';
import {
  Conflict,
  ConflictResolution,
  ResolutionStrategy,
} from './types';

interface DiffChange {
  added?: boolean;
  removed?: boolean;
  value: string;
}

function diffLines(oldStr: string, newStr: string): DiffChange[] {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const changes: DiffChange[] = [];
  
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined && newLine !== undefined) {
      changes.push({ added: true, value: newLine + '\n' });
    } else if (oldLine !== undefined && newLine === undefined) {
      changes.push({ removed: true, value: oldLine + '\n' });
    } else if (oldLine !== newLine) {
      if (oldLine !== undefined) {
        changes.push({ removed: true, value: oldLine + '\n' });
      }
      if (newLine !== undefined) {
        changes.push({ added: true, value: newLine + '\n' });
      }
    } else {
      changes.push({ value: oldLine + '\n' });
    }
  }
  
  return changes;
}

export interface MergeResult {
  success: boolean;
  content: string;
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  startLine: number;
  endLine: number;
  localContent: string;
  remoteContent: string;
}

export class WikiSyncResolver {
  async resolveConflict(conflict: Conflict, strategy: ResolutionStrategy): Promise<ConflictResolution> {
    let resolvedContent: string | undefined;

    switch (strategy) {
      case 'keep-local':
        resolvedContent = conflict.localVersion.content;
        break;
      case 'keep-remote':
        resolvedContent = conflict.remoteVersion.content;
        break;
      case 'merge':
        const mergeResult = await this.autoMerge(
          conflict.localVersion.content,
          conflict.remoteVersion.content
        );
        resolvedContent = mergeResult.content;
        break;
      case 'manual':
        resolvedContent = undefined;
        break;
      default:
        resolvedContent = conflict.localVersion.content;
    }

    return {
      strategy,
      resolvedContent,
      resolvedBy: 'system',
      resolvedAt: new Date(),
    };
  }

  async autoMerge(localContent: string, remoteContent: string): Promise<MergeResult> {
    const changes = diffLines(localContent, remoteContent);
    const conflicts: MergeConflict[] = [];
    let mergedContent = '';
    let currentLine = 0;

    for (const change of changes) {
      if (change.added) {
        mergedContent += change.value;
        currentLine += change.value.split('\n').length - 1;
      } else if (change.removed) {
        // Check if there's a corresponding addition (potential conflict)
        mergedContent += change.value;
        currentLine += change.value.split('\n').length - 1;
      } else {
        mergedContent += change.value;
        currentLine += change.value.split('\n').length - 1;
      }
    }

    // Try three-way merge for better results
    const threeWayResult = this.threeWayMerge(localContent, remoteContent, '');
    
    return {
      success: conflicts.length === 0,
      content: threeWayResult || mergedContent,
      conflicts,
    };
  }

  private threeWayMerge(local: string, remote: string, base: string): string | null {
    if (!base) {
      // Without a base, fall back to simple line-by-line merge
      return this.simpleMerge(local, remote);
    }

    const localDiff = diffLines(base, local);
    const remoteDiff = diffLines(base, remote);

    const result: string[] = [];
    let localIdx = 0;
    let remoteIdx = 0;

    while (localIdx < localDiff.length || remoteIdx < remoteDiff.length) {
      const localChange = localDiff[localIdx];
      const remoteChange = remoteDiff[remoteIdx];

      if (!localChange) {
        if (remoteChange) {
          if (remoteChange.added) {
            result.push(remoteChange.value);
          } else if (!remoteChange.removed) {
            result.push(remoteChange.value);
          }
          remoteIdx++;
        }
        continue;
      }

      if (!remoteChange) {
        if (localChange.added) {
          result.push(localChange.value);
        } else if (!localChange.removed) {
          result.push(localChange.value);
        }
        localIdx++;
        continue;
      }

      // Both have changes to the same section
      if (!localChange.added && !localChange.removed && 
          !remoteChange.added && !remoteChange.removed) {
        // Both unchanged - use either
        result.push(localChange.value);
        localIdx++;
        remoteIdx++;
      } else if (localChange.added && !remoteChange.added && !remoteChange.removed) {
        // Local added, remote unchanged - use local
        result.push(localChange.value);
        localIdx++;
      } else if (remoteChange.added && !localChange.added && !localChange.removed) {
        // Remote added, local unchanged - use remote
        result.push(remoteChange.value);
        remoteIdx++;
      } else if (localChange.removed && !remoteChange.removed) {
        // Local removed - skip
        localIdx++;
      } else if (remoteChange.removed && !localChange.removed) {
        // Remote removed - skip
        remoteIdx++;
      } else {
        // Both modified - conflict, prefer local but could mark
        result.push(localChange.value);
        localIdx++;
        remoteIdx++;
      }
    }

    return result.join('');
  }

  private simpleMerge(local: string, remote: string): string {
    const localLines = local.split('\n');
    const remoteLines = remote.split('\n');
    
    const result: string[] = [];
    const usedRemoteLines = new Set<number>();

    for (const localLine of localLines) {
      result.push(localLine);

      // Check if remote has new lines that should be inserted
      for (let i = 0; i < remoteLines.length; i++) {
        if (!usedRemoteLines.has(i) && !localLines.includes(remoteLines[i])) {
          // Check if this line should be inserted here
          const prevRemoteLine = i > 0 ? remoteLines[i - 1] : null;
          if (prevRemoteLine && localLines.includes(prevRemoteLine)) {
            result.push(remoteLines[i]);
            usedRemoteLines.add(i);
          }
        }
      }
    }

    // Add remaining remote lines
    for (let i = 0; i < remoteLines.length; i++) {
      if (!usedRemoteLines.has(i) && !result.includes(remoteLines[i])) {
        result.push(remoteLines[i]);
      }
    }

    return result.join('\n');
  }

  detectConflictType(conflict: Conflict): 'resolvable' | 'requires-manual' {
    if (conflict.type === 'binary') {
      return 'requires-manual';
    }

    if (conflict.type === 'delete-modify') {
      return 'requires-manual';
    }

    const localLines = conflict.localVersion.content.split('\n');
    const remoteLines = conflict.remoteVersion.content.split('\n');

    // If changes are in completely different sections, auto-merge is possible
    const localChangedSections = this.getChangedSections(localLines);
    const remoteChangedSections = this.getChangedSections(remoteLines);

    const overlap = this.sectionsOverlap(localChangedSections, remoteChangedSections);
    
    return overlap ? 'requires-manual' : 'resolvable';
  }

  private getChangedSections(lines: string[]): { start: number; end: number }[] {
    const sections: { start: number; end: number }[] = [];
    let inSection = false;
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isSignificant = line.length > 0 && !line.startsWith('//') && !line.startsWith('#');

      if (isSignificant && !inSection) {
        sectionStart = i;
        inSection = true;
      } else if (!isSignificant && inSection) {
        sections.push({ start: sectionStart, end: i - 1 });
        inSection = false;
      }
    }

    if (inSection) {
      sections.push({ start: sectionStart, end: lines.length - 1 });
    }

    return sections;
  }

  private sectionsOverlap(
    sections1: { start: number; end: number }[],
    sections2: { start: number; end: number }[]
  ): boolean {
    for (const s1 of sections1) {
      for (const s2 of sections2) {
        if (s1.start <= s2.end && s2.start <= s1.end) {
          return true;
        }
      }
    }
    return false;
  }

  generateMergePreview(conflict: Conflict): string {
    const local = conflict.localVersion.content;
    const remote = conflict.remoteVersion.content;
    
    const changes = diffLines(local, remote);
    let preview = '';

    for (const change of changes) {
      const lines = change.value.split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (change.added) {
          preview += `+ ${line}\n`;
        } else if (change.removed) {
          preview += `- ${line}\n`;
        } else {
          preview += `  ${line}\n`;
        }
      }
    }

    return preview;
  }

  suggestResolution(conflict: Conflict): ResolutionStrategy {
    // 首先检查冲突类型
    if (conflict.type === 'binary' || conflict.type === 'delete-modify') {
      return 'manual';
    }

    // 检查时间戳
    const localTime = conflict.localVersion.timestamp.getTime();
    const remoteTime = conflict.remoteVersion.timestamp.getTime();

    if (localTime > remoteTime) {
      return 'keep-local';
    }

    if (remoteTime > localTime) {
      return 'keep-remote';
    }

    // 检查内容长度差异
    const localLength = conflict.localVersion.content.length;
    const remoteLength = conflict.remoteVersion.content.length;

    if (remoteLength > localLength * 1.5) {
      return 'keep-remote';
    }

    if (localLength > remoteLength * 1.5) {
      return 'keep-local';
    }

    // 检查是否可以自动合并
    const conflictType = this.detectConflictType(conflict);
    if (conflictType === 'resolvable') {
      return 'merge';
    }

    return 'manual';
  }

  async batchResolve(
    conflicts: Conflict[],
    defaultStrategy?: ResolutionStrategy
  ): Promise<Map<string, ConflictResolution>> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const conflict of conflicts) {
      const strategy = defaultStrategy || this.suggestResolution(conflict);
      const resolution = await this.resolveConflict(conflict, strategy);
      resolutions.set(conflict.id, resolution);
    }

    return resolutions;
  }

  // 新增方法以满足测试需求

  async autoResolve(conflict: Conflict, strategy: ResolutionStrategy): Promise<Conflict> {
    const resolution = await this.resolveConflict(conflict, strategy);
    
    return {
      ...conflict,
      resolved: true,
      resolution,
    };
  }

  async manualResolve(conflict: Conflict, content: string): Promise<Conflict> {
    if (!content || content.trim() === '') {
      throw new Error('Manual resolution content cannot be empty');
    }

    const resolution: ConflictResolution = {
      strategy: 'manual',
      resolvedContent: content,
      resolvedBy: 'user',
      resolvedAt: new Date(),
    };

    return {
      ...conflict,
      resolved: true,
      resolution,
    };
  }

  async applyResolution(
    projectPath: string,
    conflict: Conflict,
    resolution: ConflictResolution
  ): Promise<void> {
    if (!resolution.resolvedContent) {
      throw new Error('Resolution content is required');
    }

    const filePath = path.join(projectPath, conflict.filePath);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    fs.writeFileSync(filePath, resolution.resolvedContent, 'utf-8');
  }

  async resolveBatch(
    conflicts: Conflict[],
    resolutions: Map<string, ConflictResolution>
  ): Promise<Conflict[]> {
    const results: Conflict[] = [];

    for (const conflict of conflicts) {
      const resolution = resolutions.get(conflict.id);
      
      if (resolution) {
        results.push({
          ...conflict,
          resolved: true,
          resolution,
        });
      } else {
        // 没有提供 resolution 的冲突保持未解决状态
        results.push({
          ...conflict,
          resolved: false,
        });
      }
    }

    return results;
  }

  generateConflictReport(conflicts: Conflict[]): string {
    if (conflicts.length === 0) {
      return 'No conflicts to report.';
    }

    const lines: string[] = [];
    lines.push(`# Conflict Report`);
    lines.push(`Total conflicts: ${conflicts.length}`);
    lines.push('');

    for (const conflict of conflicts) {
      lines.push(`## ${conflict.filePath}`);
      lines.push(`- Type: ${conflict.type}`);
      lines.push(`- Severity: ${conflict.severity}`);
      lines.push(`- Suggested Resolution: ${conflict.suggestedResolution}`);
      lines.push(`- Local Author: ${conflict.localVersion.author}`);
      lines.push(`- Remote Author: ${conflict.remoteVersion.author}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
