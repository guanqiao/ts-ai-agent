import { WikiPage } from '../types';
import { LLMService } from '../../llm';
import {
  ContentCategory,
  ClassificationResult,
  ClassificationMetadata,
  IContentClassifier,
  IRuleEngine,
  RuleMatchResult,
  CategoryRule,
  RuleCondition,
  DEFAULT_CATEGORY_RULES,
} from './types';

export class WikiContentClassifier implements IContentClassifier {
  private ruleEngine: IRuleEngine;
  private llmService: LLMService | null = null;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
    this.ruleEngine = new ClassificationRuleEngine();
    this.loadDefaultRules();
  }

  async classify(
    content: string,
    metadata?: ClassificationMetadata
  ): Promise<ClassificationResult> {
    const ruleResults = await this.ruleEngine.applyRules(content, metadata || {});

    if (ruleResults.length > 0) {
      const bestMatch = ruleResults[0];
      const category =
        bestMatch.actions.find((a) => a.category)?.category || ContentCategory.Unknown;
      const confidence = bestMatch.actions[0]?.confidence || 0.5;

      return {
        category,
        confidence,
        subCategories: this.extractSubCategories(ruleResults),
        suggestedTags: this.extractTags(ruleResults),
        reasoning: `Matched rule: ${bestMatch.rule.name}`,
      };
    }

    if (this.llmService) {
      return this.classifyWithAI(content, metadata);
    }

    return this.classifyByHeuristics(content, metadata);
  }

  async autoCategorize(page: WikiPage): Promise<ClassificationResult> {
    const metadata: ClassificationMetadata = {
      title: page.title,
      tags: page.metadata.tags,
      sourceFiles: page.metadata.sourceFiles,
      sections: page.sections.map((s) => s.title),
    };

    return this.classify(page.content, metadata);
  }

  async suggestCategory(content: string): Promise<ContentCategory[]> {
    const result = await this.classify(content);
    const suggestions = [result.category, ...result.subCategories];

    return [...new Set(suggestions)].filter((c) => c !== ContentCategory.Unknown);
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  addRule(rule: CategoryRule): void {
    this.ruleEngine.addRule(rule);
  }

  removeRule(ruleId: string): boolean {
    return this.ruleEngine.removeRule(ruleId);
  }

  private loadDefaultRules(): void {
    for (const rule of DEFAULT_CATEGORY_RULES) {
      this.ruleEngine.addRule(rule);
    }
  }

  private async classifyWithAI(
    content: string,
    metadata?: ClassificationMetadata
  ): Promise<ClassificationResult> {
    if (!this.llmService) {
      return this.classifyByHeuristics(content, metadata);
    }

    try {
      const prompt = `Classify the following content into one of these categories:
${Object.values(ContentCategory).join(', ')}

Title: ${metadata?.title || 'N/A'}
Tags: ${metadata?.tags?.join(', ') || 'N/A'}
Content Preview:
${content.slice(0, 1000)}

Return a JSON object with:
- category: the best matching category
- confidence: 0-1 score
- suggestedTags: array of relevant tags
- reasoning: brief explanation`;

      const response = await this.llmService.complete([{ role: 'user', content: prompt }]);

      return this.parseAIResponse(response);
    } catch {
      return this.classifyByHeuristics(content, metadata);
    }
  }

  private parseAIResponse(response: string): ClassificationResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          category: this.parseCategory(parsed.category),
          confidence: parsed.confidence || 0.5,
          subCategories: [],
          suggestedTags: parsed.suggestedTags || [],
          reasoning: parsed.reasoning || 'AI classification',
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      category: ContentCategory.Unknown,
      confidence: 0,
      subCategories: [],
      suggestedTags: [],
      reasoning: 'Failed to parse AI response',
    };
  }

  private classifyByHeuristics(
    content: string,
    metadata?: ClassificationMetadata
  ): ClassificationResult {
    const scores = new Map<ContentCategory, number>();
    const suggestedTags: string[] = [];

    const title = metadata?.title?.toLowerCase() || '';
    const contentLower = content.toLowerCase();

    if (title.includes('overview') || title.includes('summary') || title.includes('readme')) {
      scores.set(ContentCategory.Overview, 0.9);
    }

    if (title.includes('architecture') || title.includes('design') || title.includes('system')) {
      scores.set(ContentCategory.Architecture, 0.85);
    }

    if (
      contentLower.includes('api') ||
      contentLower.includes('endpoint') ||
      contentLower.includes('request') ||
      contentLower.includes('response')
    ) {
      scores.set(ContentCategory.API, 0.7);
      suggestedTags.push('api');
    }

    if (title.startsWith('module:')) {
      scores.set(ContentCategory.Module, 0.95);
    }

    if (
      contentLower.includes('getting started') ||
      contentLower.includes('how to') ||
      contentLower.includes('tutorial')
    ) {
      scores.set(ContentCategory.Guide, 0.75);
      suggestedTags.push('guide');
    }

    if (title.includes('example') || title.includes('demo')) {
      scores.set(ContentCategory.Example, 0.8);
      suggestedTags.push('example');
    }

    if (metadata?.sourceFiles?.some((f) => f.includes('.test.') || f.includes('.spec.'))) {
      scores.set(ContentCategory.Test, 0.9);
      suggestedTags.push('test');
    }

    if (title.includes('config') || title.includes('settings')) {
      scores.set(ContentCategory.Config, 0.85);
      suggestedTags.push('configuration');
    }

    if (title.toLowerCase() === 'changelog' || title.includes('release notes')) {
      scores.set(ContentCategory.Changelog, 0.95);
    }

    if (title.startsWith('adr') || title.includes('decision')) {
      scores.set(ContentCategory.Decision, 0.85);
      suggestedTags.push('adr');
    }

    let bestCategory = ContentCategory.Unknown;
    let bestScore = 0;

    for (const [category, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return {
      category: bestCategory,
      confidence: bestScore,
      subCategories: [],
      suggestedTags: [...new Set(suggestedTags)],
      reasoning: 'Heuristic classification',
    };
  }

  private extractSubCategories(results: RuleMatchResult[]): ContentCategory[] {
    const categories: ContentCategory[] = [];

    for (const result of results.slice(1, 4)) {
      const category = result.actions.find((a) => a.category)?.category;
      if (category) {
        categories.push(category);
      }
    }

    return categories;
  }

  private extractTags(results: RuleMatchResult[]): string[] {
    const tags: string[] = [];

    for (const result of results) {
      for (const action of result.actions) {
        if (action.tags) {
          tags.push(...action.tags);
        }
      }
    }

    return [...new Set(tags)];
  }

  private parseCategory(value: string): ContentCategory {
    const categoryMap: Record<string, ContentCategory> = {
      overview: ContentCategory.Overview,
      architecture: ContentCategory.Architecture,
      api: ContentCategory.API,
      module: ContentCategory.Module,
      guide: ContentCategory.Guide,
      tutorial: ContentCategory.Tutorial,
      reference: ContentCategory.Reference,
      example: ContentCategory.Example,
      test: ContentCategory.Test,
      config: ContentCategory.Config,
      changelog: ContentCategory.Changelog,
      decision: ContentCategory.Decision,
      pattern: ContentCategory.Pattern,
      'best-practice': ContentCategory.BestPractice,
      troubleshooting: ContentCategory.Troubleshooting,
    };

    return categoryMap[value.toLowerCase()] || ContentCategory.Unknown;
  }
}

class ClassificationRuleEngine implements IRuleEngine {
  private rules: Map<string, CategoryRule> = new Map();

  async applyRules(content: string, metadata: ClassificationMetadata): Promise<RuleMatchResult[]> {
    const results: RuleMatchResult[] = [];

    const sortedRules = Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matchedConditions: RuleCondition[] = [];
      let totalWeight = 0;

      for (const condition of rule.conditions) {
        const fieldValue = this.getFieldValue(condition.field, content, metadata);
        const isMatch = this.evaluateCondition(condition, fieldValue);

        if (isMatch) {
          matchedConditions.push(condition);
          totalWeight += condition.weight;
        }
      }

      if (matchedConditions.length > 0) {
        const score = totalWeight / rule.conditions.length;
        results.push({
          rule,
          matchedConditions,
          score,
          actions: rule.actions,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  addRule(rule: CategoryRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRules(): CategoryRule[] {
    return Array.from(this.rules.values());
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  private getFieldValue(field: string, content: string, metadata: ClassificationMetadata): unknown {
    switch (field) {
      case 'title':
        return metadata.title || '';
      case 'content':
        return content;
      case 'tags':
        return metadata.tags || [];
      case 'sourceFiles':
        return metadata.sourceFiles || [];
      case 'symbols':
        return metadata.symbols || [];
      case 'sections':
        return metadata.sections || [];
      case 'links':
        return [];
      default:
        return '';
    }
  }

  private evaluateCondition(condition: RuleCondition, fieldValue: unknown): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'contains':
        return this.evaluateContains(fieldValue, value);
      case 'notContains':
        return !this.evaluateContains(fieldValue, value);
      case 'matches':
        return this.evaluateMatches(fieldValue, value);
      case 'startsWith':
        return this.evaluateStartsWith(fieldValue, value);
      case 'endsWith':
        return this.evaluateEndsWith(fieldValue, value);
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue as string);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue as string);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      default:
        return false;
    }
  }

  private evaluateContains(fieldValue: unknown, value: unknown): boolean {
    if (typeof fieldValue === 'string' && typeof value === 'string') {
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    }
    if (typeof fieldValue === 'string' && Array.isArray(value)) {
      return value.some((v) => fieldValue.toLowerCase().includes(v.toLowerCase()));
    }
    if (Array.isArray(fieldValue) && typeof value === 'string') {
      return fieldValue.some((v) => v.toLowerCase().includes(value.toLowerCase()));
    }
    return false;
  }

  private evaluateMatches(fieldValue: unknown, value: unknown): boolean {
    if (typeof fieldValue === 'string') {
      try {
        const regex = value instanceof RegExp ? value : new RegExp(value as string, 'i');
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    }
    if (Array.isArray(fieldValue)) {
      try {
        const regex = value instanceof RegExp ? value : new RegExp(value as string, 'i');
        return fieldValue.some((v) => regex.test(v));
      } catch {
        return false;
      }
    }
    return false;
  }

  private evaluateStartsWith(fieldValue: unknown, value: unknown): boolean {
    if (typeof fieldValue === 'string' && typeof value === 'string') {
      return fieldValue.toLowerCase().startsWith(value.toLowerCase());
    }
    return false;
  }

  private evaluateEndsWith(fieldValue: unknown, value: unknown): boolean {
    if (typeof fieldValue === 'string' && typeof value === 'string') {
      return fieldValue.toLowerCase().endsWith(value.toLowerCase());
    }
    return false;
  }
}
