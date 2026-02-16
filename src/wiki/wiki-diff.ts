import { WikiDiffResult, WikiDiffChange } from './types';

export class WikiDiff {
  /**
   * Myers 差异算法实现 - 计算两个文本的最短编辑脚本
   */
  static computeMyersDiff(oldText: string, newText: string): WikiDiffResult {
    const oldLines = oldText ? oldText.split('\n') : [];
    const newLines = newText ? newText.split('\n') : [];

    const { additions, deletions, changes } = this.myersAlgorithm(oldLines, newLines);

    return {
      oldVersion: 0,
      newVersion: 0,
      additions,
      deletions,
      changes,
    };
  }

  /**
   * Myers 算法核心实现
   */
  private static myersAlgorithm(
    oldLines: string[],
    newLines: string[]
  ): {
    additions: number;
    deletions: number;
    changes: WikiDiffChange[];
  } {
    const n = oldLines.length;
    const m = newLines.length;

    // 处理边界情况
    if (n === 0 && m === 0) {
      return { additions: 0, deletions: 0, changes: [] };
    }
    if (n === 0) {
      return {
        additions: m,
        deletions: 0,
        changes: newLines.map((line, i) => ({
          type: 'added',
          lineNumber: i + 1,
          newContent: line,
        })),
      };
    }
    if (m === 0) {
      return {
        additions: 0,
        deletions: n,
        changes: oldLines.map((line, i) => ({
          type: 'removed',
          lineNumber: i + 1,
          oldContent: line,
        })),
      };
    }

    const max = n + m;
    const v: number[] = new Array(2 * max + 1);
    const trace: number[][] = [];

    v[max + 1] = 0;

    for (let d = 0; d <= max; d++) {
      trace.push([...v]);

      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
          x = v[max + k + 1];
        } else {
          x = v[max + k - 1] + 1;
        }

        let y = x - k;

        while (x < n && y < m && oldLines[x] === newLines[y]) {
          x++;
          y++;
        }

        v[max + k] = x;

        if (x >= n && y >= m) {
          return this.backtrack(trace, oldLines, newLines, d, max);
        }
      }
    }

    return { additions: 0, deletions: 0, changes: [] };
  }

  /**
   * 回溯找出编辑路径
   */
  private static backtrack(
    trace: number[][],
    oldLines: string[],
    newLines: string[],
    d: number,
    max: number
  ): {
    additions: number;
    deletions: number;
    changes: WikiDiffChange[];
  } {
    const changes: WikiDiffChange[] = [];
    let additions = 0;
    let deletions = 0;

    let x = oldLines.length;
    let y = newLines.length;

    for (let d_idx = d; d_idx > 0; d_idx--) {
      const v = trace[d_idx];
      const k = x - y;

      let prevK: number;
      if (k === -d_idx || (k !== d_idx && v[max + k - 1] < v[max + k + 1])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = v[max + prevK];
      const prevY = prevX - prevK;

      // 添加对角线移动（相同行）
      while (x > prevX && y > prevY) {
        x--;
        y--;
      }

      // 添加编辑操作
      if (x > prevX) {
        // 删除行
        changes.unshift({
          type: 'removed',
          lineNumber: x,
          oldContent: oldLines[x - 1],
        });
        deletions++;
        x--;
      } else if (y > prevY) {
        // 添加行
        changes.unshift({
          type: 'added',
          lineNumber: y,
          newContent: newLines[y - 1],
        });
        additions++;
        y--;
      }
    }

    return { additions, deletions, changes };
  }

  /**
   * 简单的行级差异计算（用于快速对比）
   */
  static computeSimpleDiff(oldText: string, newText: string): WikiDiffResult {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const changes: WikiDiffChange[] = [];
    let additions = 0;
    let deletions = 0;

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        changes.push({
          type: 'added',
          lineNumber: i + 1,
          newContent: newLine,
        });
        additions++;
      } else if (oldLine !== undefined && newLine === undefined) {
        changes.push({
          type: 'removed',
          lineNumber: i + 1,
          oldContent: oldLine,
        });
        deletions++;
      } else if (oldLine !== newLine) {
        changes.push({
          type: 'modified',
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: newLine,
        });
        additions++;
        deletions++;
      }
    }

    return {
      oldVersion: 0,
      newVersion: 0,
      additions,
      deletions,
      changes,
    };
  }

  /**
   * 生成统一的 Diff 格式输出（类似 git diff）
   */
  static generateUnifiedDiff(
    oldText: string,
    newText: string,
    oldVersion: number,
    newVersion: number,
    contextLines: number = 3
  ): string {
    const result = this.computeMyersDiff(oldText, newText);
    result.oldVersion = oldVersion;
    result.newVersion = newVersion;

    let output = `--- Version ${oldVersion}\n`;
    output += `+++ Version ${newVersion}\n`;

    if (result.changes.length === 0) {
      return output + '（无变更）';
    }

    // 将变更分组为 hunk
    const hunks = this.groupChangesIntoHunks(result.changes, contextLines);

    for (const hunk of hunks) {
      const oldStart = hunk.oldStart;
      const oldCount = hunk.oldCount;
      const newStart = hunk.newStart;
      const newCount = hunk.newCount;

      output += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;

      for (const change of hunk.changes) {
        switch (change.type) {
          case 'added':
            output += `+${change.newContent}\n`;
            break;
          case 'removed':
            output += `-${change.oldContent}\n`;
            break;
          case 'modified':
            output += `-${change.oldContent}\n`;
            output += `+${change.newContent}\n`;
            break;
        }
      }
    }

    return output;
  }

  /**
   * 生成 HTML 格式的 Diff（用于 Web 界面）
   */
  static generateHtmlDiff(
    oldText: string,
    newText: string,
    oldVersion: number,
    newVersion: number
  ): string {
    const result = this.computeMyersDiff(oldText, newText);

    let html = '<div class="wiki-diff">';
    html += `<div class="diff-header">`;
    html += `<span class="diff-old">Version ${oldVersion}</span>`;
    html += `<span class="diff-arrow">→</span>`;
    html += `<span class="diff-new">Version ${newVersion}</span>`;
    html += `<span class="diff-stats">+${result.additions}/-${result.deletions}</span>`;
    html += `</div>`;
    html += '<div class="diff-content">';

    if (result.changes.length === 0) {
      html += '<div class="diff-no-changes">（无变更）</div>';
    } else {
      html += '<table class="diff-table">';
      html += '<tbody>';

      for (const change of result.changes) {
        const cssClass = `diff-${change.type}`;
        html += `<tr class="${cssClass}">`;
        html += `<td class="line-num old">${change.type !== 'added' ? change.lineNumber : ''}</td>`;
        html += `<td class="line-num new">${change.type !== 'removed' ? change.lineNumber : ''}</td>`;
        html += '<td class="line-content">';

        switch (change.type) {
          case 'added':
            html += `<span class="diff-marker">+</span>${this.escapeHtml(change.newContent || '')}`;
            break;
          case 'removed':
            html += `<span class="diff-marker">-</span>${this.escapeHtml(change.oldContent || '')}`;
            break;
          case 'modified':
            html += `<span class="diff-marker">-</span>${this.escapeHtml(change.oldContent || '')}<br>`;
            html += `<span class="diff-marker">+</span>${this.escapeHtml(change.newContent || '')}`;
            break;
        }

        html += '</td></tr>';
      }

      html += '</tbody></table>';
    }

    html += '</div></div>';
    return html;
  }

  /**
   * 将变更分组为 hunk（用于统一 diff 格式）
   */
  private static groupChangesIntoHunks(
    changes: WikiDiffChange[],
    contextLines: number
  ): Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    changes: WikiDiffChange[];
  }> {
    if (changes.length === 0) return [];

    const hunks: Array<{
      oldStart: number;
      newStart: number;
      changes: WikiDiffChange[];
    }> = [];

    let currentHunk: (typeof hunks)[0] | null = null;

    for (const change of changes) {
      if (
        !currentHunk ||
        change.lineNumber - currentHunk.changes[currentHunk.changes.length - 1].lineNumber >
          contextLines * 2
      ) {
        currentHunk = {
          oldStart: change.lineNumber,
          newStart: change.lineNumber,
          changes: [],
        };
        hunks.push(currentHunk);
      }
      currentHunk.changes.push(change);
    }

    return hunks.map((hunk) => ({
      oldStart: hunk.oldStart,
      oldCount: hunk.changes.filter((c) => c.type !== 'added').length,
      newStart: hunk.newStart,
      newCount: hunk.changes.filter((c) => c.type !== 'removed').length,
      changes: hunk.changes,
    }));
  }

  /**
   * HTML 转义
   */
  private static escapeHtml(text: string): string {
    const div = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => div[m as keyof typeof div]);
  }

  /**
   * 计算文本相似度（0-1）
   */
  static calculateSimilarity(oldText: string, newText: string): number {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const lcs = this.longestCommonSubsequence(oldLines, newLines);
    const maxLength = Math.max(oldLines.length, newLines.length);

    return maxLength === 0 ? 1 : lcs / maxLength;
  }

  /**
   * 最长公共子序列长度
   */
  private static longestCommonSubsequence(a: string[], b: string[]): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}
