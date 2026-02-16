import { WikiDiff } from '../../src/wiki/wiki-diff';

describe('WikiDiff', () => {
  describe('computeMyersDiff', () => {
    it('should detect added lines', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = 'Line 1\nLine 2\nLine 3';

      const result = WikiDiff.computeMyersDiff(oldText, newText);

      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(0);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('added');
      expect(result.changes[0].newContent).toBe('Line 3');
    });

    it('should detect removed lines', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nLine 3';

      const result = WikiDiff.computeMyersDiff(oldText, newText);

      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(1);
    });

    it('should detect modified lines', () => {
      const oldText = 'Line 1\nOld Line 2\nLine 3';
      const newText = 'Line 1\nNew Line 2\nLine 3';

      const result = WikiDiff.computeMyersDiff(oldText, newText);

      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should handle empty texts', () => {
      const result = WikiDiff.computeMyersDiff('', '');
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should handle completely new content', () => {
      const oldText = '';
      const newText = 'Line 1\nLine 2';

      const result = WikiDiff.computeMyersDiff(oldText, newText);

      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(0);
    });

    it('should handle completely removed content', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = '';

      const result = WikiDiff.computeMyersDiff(oldText, newText);

      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(2);
    });
  });

  describe('computeSimpleDiff', () => {
    it('should compute simple line-by-line diff', () => {
      const oldText = 'A\nB\nC';
      const newText = 'A\nX\nC\nD';

      const result = WikiDiff.computeSimpleDiff(oldText, newText);

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.additions).toBeGreaterThan(0);
    });
  });

  describe('generateUnifiedDiff', () => {
    it('should generate unified diff format', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = 'Line 1\nModified Line 2';

      const result = WikiDiff.generateUnifiedDiff(oldText, newText, 1, 2);

      expect(result).toContain('--- Version 1');
      expect(result).toContain('+++ Version 2');
      expect(result).toContain('@@');
    });

    it('should indicate no changes when texts are identical', () => {
      const text = 'Line 1\nLine 2';

      const result = WikiDiff.generateUnifiedDiff(text, text, 1, 2);

      expect(result).toContain('（无变更）');
    });
  });

  describe('generateHtmlDiff', () => {
    it('should generate HTML diff', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = 'Line 1\nModified Line 2';

      const result = WikiDiff.generateHtmlDiff(oldText, newText, 1, 2);

      expect(result).toContain('<div class="wiki-diff">');
      expect(result).toContain('Version 1');
      expect(result).toContain('Version 2');
      expect(result).toContain('<table class="diff-table">');
    });

    it('should escape HTML in content', () => {
      const oldText = 'Line with <script>alert("xss")</script>';
      const newText = 'Safe line';

      const result = WikiDiff.generateHtmlDiff(oldText, newText, 1, 2);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const similarity = WikiDiff.calculateSimilarity(text, text);
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      const oldText = 'A\nB\nC';
      const newText = 'X\nY\nZ';
      const similarity = WikiDiff.calculateSimilarity(oldText, newText);
      expect(similarity).toBe(0);
    });

    it('should return value between 0 and 1 for partially similar texts', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nModified\nLine 3';
      const similarity = WikiDiff.calculateSimilarity(oldText, newText);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle empty texts', () => {
      expect(WikiDiff.calculateSimilarity('', '')).toBe(1);
      expect(WikiDiff.calculateSimilarity('', 'something')).toBe(0);
    });
  });
});
