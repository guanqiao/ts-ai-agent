export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface MergeResult {
  content: string;
  conflicts: MergeConflict[];
  resolved: boolean;
}

export interface MergeConflict {
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  base?: string;
}

export class MyersDiff {
  diff(oldContent: string, newContent: string): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const edits = this.computeEditScript(oldLines, newLines);
    const hunks = this.buildHunks(edits, oldLines, newLines);

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'added') {
          additions++;
        } else if (line.type === 'removed') {
          deletions++;
        } else {
          unchanged++;
        }
      }
    }

    return { hunks, additions, deletions, unchanged };
  }

  merge(
    baseContent: string,
    oursContent: string,
    theirsContent: string
  ): MergeResult {
    const baseLines = baseContent.split('\n');
    const oursLines = oursContent.split('\n');
    const theirsLines = theirsContent.split('\n');

    const oursDiff = this.diff(baseContent, oursContent);
    const theirsDiff = this.diff(baseContent, theirsContent);

    const conflicts: MergeConflict[] = [];
    const resultLines: string[] = [];

    const oursChanges = this.extractChanges(oursDiff);
    const theirsChanges = this.extractChanges(theirsDiff);

    let baseLineIndex = 0;
    let oursLineIndex = 0;
    let theirsLineIndex = 0;

    while (baseLineIndex < baseLines.length) {
      const oursChange = this.findChangeAtLine(oursChanges, baseLineIndex, 'old');
      const theirsChange = this.findChangeAtLine(theirsChanges, baseLineIndex, 'old');

      if (oursChange && theirsChange) {
        if (this.changesOverlap(oursChange, theirsChange)) {
          if (this.changesAreSame(oursChange, theirsChange)) {
            resultLines.push(...oursChange.addedLines);
            baseLineIndex = Math.max(oursChange.oldEnd, theirsChange.oldEnd);
            oursLineIndex = oursChange.newEnd;
            theirsLineIndex = theirsChange.newEnd;
          } else {
            conflicts.push({
              startLine: resultLines.length + 1,
              endLine: resultLines.length + Math.max(oursChange.addedLines.length, theirsChange.addedLines.length),
              ours: oursChange.addedLines.join('\n'),
              theirs: theirsChange.addedLines.join('\n'),
              base: baseLines.slice(oursChange.oldStart - 1, oursChange.oldEnd).join('\n'),
            });

            resultLines.push(`<<<<<<< OURS`);
            resultLines.push(...oursChange.addedLines);
            resultLines.push(`=======`);
            resultLines.push(...theirsChange.addedLines);
            resultLines.push(`>>>>>>> THEIRS`);

            baseLineIndex = Math.max(oursChange.oldEnd, theirsChange.oldEnd);
          }
        } else {
          if (oursChange.oldStart <= theirsChange.oldStart) {
            resultLines.push(...oursChange.addedLines);
            baseLineIndex = oursChange.oldEnd;
          } else {
            resultLines.push(...theirsChange.addedLines);
            baseLineIndex = theirsChange.oldEnd;
          }
        }
      } else if (oursChange) {
        resultLines.push(...oursChange.addedLines);
        baseLineIndex = oursChange.oldEnd;
      } else if (theirsChange) {
        resultLines.push(...theirsChange.addedLines);
        baseLineIndex = theirsChange.oldEnd;
      } else {
        resultLines.push(baseLines[baseLineIndex]);
        baseLineIndex++;
      }
    }

    while (oursLineIndex < oursLines.length) {
      resultLines.push(oursLines[oursLineIndex]);
      oursLineIndex++;
    }

    while (theirsLineIndex < theirsLines.length) {
      if (!resultLines.includes(theirsLines[theirsLineIndex])) {
        resultLines.push(theirsLines[theirsLineIndex]);
      }
      theirsLineIndex++;
    }

    return {
      content: resultLines.join('\n'),
      conflicts,
      resolved: conflicts.length === 0,
    };
  }

  applyDiff(content: string, diff: DiffResult): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let lineIndex = 0;

    for (const hunk of diff.hunks) {
      while (lineIndex < hunk.oldStart - 1) {
        result.push(lines[lineIndex]);
        lineIndex++;
      }

      for (const diffLine of hunk.lines) {
        if (diffLine.type === 'unchanged') {
          result.push(lines[lineIndex]);
          lineIndex++;
        } else if (diffLine.type === 'removed') {
          lineIndex++;
        } else if (diffLine.type === 'added') {
          result.push(diffLine.content);
        }
      }
    }

    while (lineIndex < lines.length) {
      result.push(lines[lineIndex]);
      lineIndex++;
    }

    return result.join('\n');
  }

  generateUnifiedDiff(oldContent: string, newContent: string, _contextLines: number = 3): string {
    const result = this.diff(oldContent, newContent);
    const output: string[] = [];

    for (const hunk of result.hunks) {
      output.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

      for (const line of hunk.lines) {
        if (line.type === 'added') {
          output.push(`+${line.content}`);
        } else if (line.type === 'removed') {
          output.push(`-${line.content}`);
        } else {
          output.push(` ${line.content}`);
        }
      }
    }

    return output.join('\n');
  }

  private computeEditScript(oldLines: string[], newLines: string[]): Array<{ type: 'delete' | 'insert' | 'equal'; oldIndex: number; newIndex: number }> {
    const m = oldLines.length;
    const n = newLines.length;
    const max = m + n;
    const v: number[] = new Array(2 * max + 1).fill(0);
    const trace: number[][] = [];

    for (let d = 0; d <= max; d++) {
      trace.push([...v]);

      for (let k = -d; k <= d; k += 2) {
        let x: number;

        if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
          x = v[k + 1 + max];
        } else {
          x = v[k - 1 + max] + 1;
        }

        let y = x - k;

        while (x < m && y < n && oldLines[x] === newLines[y]) {
          x++;
          y++;
        }

        v[k + max] = x;

        if (x >= m && y >= n) {
          return this.backtrack(trace, oldLines, newLines, max);
        }
      }
    }

    return [];
  }

  private backtrack(
    trace: number[][],
    oldLines: string[],
    newLines: string[],
    max: number
  ): Array<{ type: 'delete' | 'insert' | 'equal'; oldIndex: number; newIndex: number }> {
    const edits: Array<{ type: 'delete' | 'insert' | 'equal'; oldIndex: number; newIndex: number }> = [];
    let x = oldLines.length;
    let y = newLines.length;

    for (let d = trace.length - 1; d >= 0; d--) {
      const v = trace[d];
      const k = x - y;

      let prevK: number;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = v[prevK + max];
      const prevY = prevX - prevK;

      while (x > prevX && y > prevY) {
        edits.unshift({ type: 'equal', oldIndex: x - 1, newIndex: y - 1 });
        x--;
        y--;
      }

      if (d > 0) {
        if (x === prevX) {
          edits.unshift({ type: 'insert', oldIndex: x, newIndex: y - 1 });
          y--;
        } else {
          edits.unshift({ type: 'delete', oldIndex: x - 1, newIndex: y });
          x--;
        }
      }
    }

    return edits;
  }

  private buildHunks(
    edits: Array<{ type: 'delete' | 'insert' | 'equal'; oldIndex: number; newIndex: number }>,
    oldLines: string[],
    newLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLine = 1;
    let newLine = 1;

    for (const edit of edits) {
      if (edit.type === 'equal') {
        if (currentHunk) {
          currentHunk.lines.push({
            type: 'unchanged',
            content: oldLines[edit.oldIndex],
            oldLineNumber: oldLine,
            newLineNumber: newLine,
          });
        }
        oldLine++;
        newLine++;
      } else if (edit.type === 'delete') {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: 'removed',
          content: oldLines[edit.oldIndex],
          oldLineNumber: oldLine,
        });
        currentHunk.oldLines++;
        oldLine++;
      } else if (edit.type === 'insert') {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: 'added',
          content: newLines[edit.newIndex],
          newLineNumber: newLine,
        });
        currentHunk.newLines++;
        newLine++;
      }

      if (currentHunk && this.shouldEndHunk(currentHunk, edit)) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  private shouldEndHunk(hunk: DiffHunk, edit: { type: string }): boolean {
    if (edit.type !== 'equal') {
      return false;
    }

    const unchangedCount = hunk.lines.filter(l => l.type === 'unchanged').length;
    return unchangedCount >= 3;
  }

  private extractChanges(diff: DiffResult): Array<{
    oldStart: number;
    oldEnd: number;
    newStart: number;
    newEnd: number;
    addedLines: string[];
    removedLines: string[];
  }> {
    const changes: Array<{
      oldStart: number;
      oldEnd: number;
      newStart: number;
      newEnd: number;
      addedLines: string[];
      removedLines: string[];
    }> = [];

    for (const hunk of diff.hunks) {
      const addedLines = hunk.lines
        .filter(l => l.type === 'added')
        .map(l => l.content);
      const removedLines = hunk.lines
        .filter(l => l.type === 'removed')
        .map(l => l.content);

      if (addedLines.length > 0 || removedLines.length > 0) {
        changes.push({
          oldStart: hunk.oldStart,
          oldEnd: hunk.oldStart + hunk.oldLines,
          newStart: hunk.newStart,
          newEnd: hunk.newStart + hunk.newLines,
          addedLines,
          removedLines,
        });
      }
    }

    return changes;
  }

  private findChangeAtLine(
    changes: Array<{ oldStart: number; oldEnd: number; newStart: number; newEnd: number; addedLines: string[]; removedLines: string[] }>,
    line: number,
    type: 'old' | 'new'
  ): typeof changes[0] | null {
    for (const change of changes) {
      if (type === 'old' && line >= change.oldStart - 1 && line < change.oldEnd) {
        return change;
      }
      if (type === 'new' && line >= change.newStart - 1 && line < change.newEnd) {
        return change;
      }
    }
    return null;
  }

  private changesOverlap(
    change1: { oldStart: number; oldEnd: number },
    change2: { oldStart: number; oldEnd: number }
  ): boolean {
    return !(change1.oldEnd <= change2.oldStart || change2.oldEnd <= change1.oldStart);
  }

  private changesAreSame(
    change1: { addedLines: string[]; removedLines: string[] },
    change2: { addedLines: string[]; removedLines: string[] }
  ): boolean {
    const added1 = change1.addedLines.join('\n');
    const added2 = change2.addedLines.join('\n');
    const removed1 = change1.removedLines.join('\n');
    const removed2 = change2.removedLines.join('\n');

    return added1 === added2 && removed1 === removed2;
  }
}
