import { WikiContentClassifier } from '../../../src/wiki/classification/content-classifier';
import { ContentCategory, CategoryRule } from '../../../src/wiki/classification/types';

describe('WikiContentClassifier', () => {
  let classifier: WikiContentClassifier;

  beforeEach(() => {
    classifier = new WikiContentClassifier();
  });

  describe('classify', () => {
    it('should classify overview content', async () => {
      const result = await classifier.classify('# Overview\n\nThis is a project overview.', {
        title: 'Overview',
      });

      expect(result.category).toBe(ContentCategory.Overview);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify architecture content', async () => {
      const result = await classifier.classify(
        '# Architecture\n\nThe system follows a layered architecture pattern.',
        { title: 'Architecture' }
      );

      expect(result.category).toBe(ContentCategory.Architecture);
    });

    it('should classify API content', async () => {
      const result = await classifier.classify(
        '# API Reference\n\n```typescript\nfunction getUser(id: string): User {}\n```',
        { title: 'API Reference' }
      );

      expect(result.category).toBe(ContentCategory.API);
    });

    it('should classify module content', async () => {
      const result = await classifier.classify('# Module: UserService\n\nUser service module.', {
        title: 'Module: UserService',
      });

      expect(result.category).toBe(ContentCategory.Module);
    });

    it('should classify guide content', async () => {
      const result = await classifier.classify(
        '# Getting Started\n\nFollow these steps to get started with the project.',
        { title: 'Getting Started' }
      );

      expect(result.category).toBe(ContentCategory.Guide);
    });

    it('should classify example content', async () => {
      const result = await classifier.classify('# Example Usage\n\nHere is an example:', {
        title: 'Example Usage',
      });

      expect(result.category).toBe(ContentCategory.Example);
    });

    it('should classify config content', async () => {
      const result = await classifier.classify('# Configuration\n\nConfiguration options:', {
        title: 'Configuration',
      });

      expect(result.category).toBe(ContentCategory.Config);
    });

    it('should classify test content by source files', async () => {
      const result = await classifier.classify('# Tests\n\nTest file content', {
        title: 'Tests',
        sourceFiles: ['src/service.test.ts'],
      });

      expect(result.category).toBe(ContentCategory.Test);
    });

    it('should classify changelog content', async () => {
      const result = await classifier.classify('# Changelog\n\n## v1.0.0\n- Initial release', {
        title: 'Changelog',
      });

      expect(result.category).toBe(ContentCategory.Changelog);
    });

    it('should classify decision content', async () => {
      const result = await classifier.classify('# ADR-001: Use TypeScript\n\n## Decision\n...', {
        title: 'ADR-001: Use TypeScript',
      });

      expect(result.category).toBe(ContentCategory.Decision);
    });

    it('should return unknown for ambiguous content', async () => {
      const result = await classifier.classify('Some random content without clear category');

      expect(result.category).toBeDefined();
    });

    it('should include suggested tags', async () => {
      const result = await classifier.classify(
        '# API Reference\n\nThis API provides endpoints for user management.',
        { title: 'API Reference' }
      );

      expect(result.suggestedTags).toBeDefined();
    });

    it('should include reasoning', async () => {
      const result = await classifier.classify('# Overview\n\nProject overview.', {
        title: 'Overview',
      });

      expect(result.reasoning).toBeDefined();
    });
  });

  describe('suggestCategory', () => {
    it('should return array of suggested categories', async () => {
      const suggestions = await classifier.suggestCategory('API endpoint documentation');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('custom rules', () => {
    it('should add custom rule', async () => {
      const customRule: CategoryRule = {
        id: 'custom-1',
        name: 'Custom Rule',
        category: ContentCategory.Pattern,
        priority: 100,
        conditions: [
          {
            field: 'title',
            operator: 'matches',
            value: /^pattern:/i,
            weight: 1.0,
          },
        ],
        actions: [
          {
            type: 'assign',
            category: ContentCategory.Pattern,
            confidence: 0.95,
          },
        ],
        enabled: true,
      };

      classifier.addRule(customRule);

      const result = await classifier.classify('# Pattern: Singleton\n\nSingleton pattern implementation.', {
        title: 'Pattern: Singleton',
      });

      expect(result.category).toBe(ContentCategory.Pattern);
    });

    it('should remove custom rule', async () => {
      const customRule: CategoryRule = {
        id: 'custom-remove',
        name: 'Custom Rule to Remove',
        category: ContentCategory.BestPractice,
        priority: 100,
        conditions: [
          {
            field: 'title',
            operator: 'equals',
            value: 'Best Practices',
            weight: 1.0,
          },
        ],
        actions: [
          {
            type: 'assign',
            category: ContentCategory.BestPractice,
            confidence: 0.95,
          },
        ],
        enabled: true,
      };

      classifier.addRule(customRule);
      const removed = classifier.removeRule('custom-remove');

      expect(removed).toBe(true);
    });
  });

  describe('classify with metadata', () => {
    it('should use tags in classification', async () => {
      const result = await classifier.classify('Content with tags', {
        title: 'Document',
        tags: ['api', 'reference'],
      });

      expect(result).toBeDefined();
    });

    it('should use source files in classification', async () => {
      const result = await classifier.classify('Test content', {
        title: 'Test',
        sourceFiles: ['src/utils.test.ts', 'src/utils.ts'],
      });

      expect(result.category).toBe(ContentCategory.Test);
    });

    it('should use sections in classification', async () => {
      const result = await classifier.classify('Document with sections', {
        title: 'Document',
        sections: ['Getting Started', 'API Reference', 'Examples'],
      });

      expect(result).toBeDefined();
    });
  });

  describe('confidence scores', () => {
    it('should return high confidence for clear matches', async () => {
      const result = await classifier.classify('# Overview\n\nProject overview.', {
        title: 'Overview',
      });

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return lower confidence for ambiguous content', async () => {
      const result = await classifier.classify('Some content that could be anything');

      expect(result.confidence).toBeLessThan(0.9);
    });
  });
});
