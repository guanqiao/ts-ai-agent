import * as crypto from 'crypto';
import { WikiPage } from '../types';
import { LLMService } from '../../llm';
import {
  QualityScore,
  QualityGrade,
  DimensionScore,
  QualityIssue,
  QualityReport,
  QualityRecommendation,
  QualityMetadata,
  IQualityEvaluator,
  QualityDimension,
  QUALITY_THRESHOLDS,
  DIMENSION_WEIGHTS,
} from './types';

export class DocumentQualityEvaluator implements IQualityEvaluator {
  private scoreHistory: Map<string, QualityScore[]> = new Map();
  private reports: Map<string, QualityReport> = new Map();

  constructor(_llmService?: LLMService) {}

  async evaluate(content: string, metadata?: QualityMetadata): Promise<QualityScore> {
    const dimensions = await this.evaluateDimensions(content, metadata);
    const overall = this.calculateOverallScore(dimensions);
    const grade = this.determineGrade(overall);

    return {
      overall,
      dimensions,
      grade,
    };
  }

  async getScore(pageId: string): Promise<QualityScore | null> {
    const report = this.reports.get(pageId);
    return report?.score || null;
  }

  async getReport(pageId: string): Promise<QualityReport | null> {
    return this.reports.get(pageId) || null;
  }

  async generateReport(
    pageId: string,
    content: string,
    metadata?: QualityMetadata
  ): Promise<QualityReport> {
    const score = await this.evaluate(content, metadata);
    const issues = this.collectIssues(score.dimensions);
    const recommendations = this.generateRecommendations(score, issues);
    const previousScore = this.getPreviousScore(pageId);
    const trend = this.determineTrend(score.overall, previousScore);

    const report: QualityReport = {
      pageId,
      pageTitle: metadata?.title || pageId,
      score,
      issues,
      recommendations,
      generatedAt: new Date(),
      previousScore,
      trend,
    };

    this.storeScore(pageId, score);
    this.reports.set(pageId, report);

    return report;
  }

  evaluatePage(page: WikiPage): Promise<QualityReport> {
    const metadata: QualityMetadata = {
      title: page.title,
      wordCount: this.countWords(page.content),
      sectionCount: page.sections.length,
      linkCount: this.countLinks(page.content),
      codeBlockCount: this.countCodeBlocks(page.content),
    };

    return this.generateReport(page.id, page.content, metadata);
  }

  setLLMService(_llmService: LLMService): void {}

  private async evaluateDimensions(
    content: string,
    metadata?: QualityMetadata
  ): Promise<DimensionScore[]> {
    const dimensions: DimensionScore[] = [];

    dimensions.push(await this.evaluateCompleteness(content));
    dimensions.push(await this.evaluateAccuracy(content, metadata));
    dimensions.push(await this.evaluateReadability(content));
    dimensions.push(await this.evaluateStructure(content));
    dimensions.push(await this.evaluateCoverage(content, metadata));
    dimensions.push(await this.evaluateFreshness(metadata));
    dimensions.push(await this.evaluateConsistency(content));

    return dimensions;
  }

  private async evaluateCompleteness(content: string): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    const hasOverview = this.hasSection(content, ['overview', 'introduction', 'summary']);
    if (!hasOverview) {
      score -= 20;
      issues.push(this.createIssue('completeness', 'major', 'Missing overview section'));
    }

    const hasUsage = this.hasSection(content, ['usage', 'getting started', 'how to use']);
    if (!hasUsage) {
      score -= 15;
      issues.push(this.createIssue('completeness', 'major', 'Missing usage section'));
    }

    const hasExamples = this.hasSection(content, ['example', 'examples', 'demo']);
    if (!hasExamples) {
      score -= 10;
      issues.push(this.createIssue('completeness', 'minor', 'Missing examples section'));
    }

    const hasAPI = this.hasSection(content, ['api', 'reference', 'methods', 'functions']);
    if (!hasAPI) {
      score -= 10;
      issues.push(this.createIssue('completeness', 'minor', 'Missing API reference'));
    }

    return {
      name: 'completeness',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.completeness,
      issues,
    };
  }

  private async evaluateAccuracy(
    content: string,
    _metadata?: QualityMetadata
  ): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 85;

    const brokenLinks = this.findBrokenLinkPatterns(content);
    if (brokenLinks.length > 0) {
      score -= brokenLinks.length * 5;
      issues.push(
        this.createIssue(
          'accuracy',
          'major',
          `Found ${brokenLinks.length} potentially broken link patterns`
        )
      );
    }

    const codeBlocks = this.extractCodeBlocks(content);
    for (const block of codeBlocks) {
      if (this.hasSyntaxIssues(block)) {
        score -= 5;
        issues.push(this.createIssue('accuracy', 'minor', 'Code block may have syntax issues'));
      }
    }

    return {
      name: 'accuracy',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.accuracy,
      issues,
    };
  }

  private async evaluateReadability(content: string): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength =
      sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
        : 0;

    if (avgSentenceLength > 25) {
      score -= 15;
      issues.push(this.createIssue('readability', 'minor', 'Sentences are too long on average'));
    }

    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const avgParagraphLength =
      paragraphs.length > 0
        ? paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length
        : 0;

    if (avgParagraphLength > 150) {
      score -= 10;
      issues.push(this.createIssue('readability', 'minor', 'Paragraphs are too long'));
    }

    const complexWords = this.countComplexWords(content);
    const totalWords = this.countWords(content);
    const complexRatio = totalWords > 0 ? complexWords / totalWords : 0;

    if (complexRatio > 0.2) {
      score -= 10;
      issues.push(this.createIssue('readability', 'minor', 'High ratio of complex words'));
    }

    return {
      name: 'readability',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.readability,
      issues,
    };
  }

  private async evaluateStructure(content: string): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    const headings = this.extractHeadings(content);
    if (headings.length === 0) {
      score -= 30;
      issues.push(this.createIssue('structure', 'critical', 'No headings found'));
    }

    const maxDepth = Math.max(...headings.map((h) => h.depth), 0);
    if (maxDepth > 4) {
      score -= 15;
      issues.push(this.createIssue('structure', 'minor', 'Heading depth exceeds 4 levels'));
    }

    const headingOrder = this.checkHeadingOrder(headings);
    if (!headingOrder.valid) {
      score -= 10;
      issues.push(this.createIssue('structure', 'minor', 'Heading order is inconsistent'));
    }

    const hasTOC = content.includes('## Table of Contents') || content.includes('## Contents');
    if (headings.length > 10 && !hasTOC) {
      score -= 5;
      issues.push(
        this.createIssue('structure', 'suggestion', 'Consider adding a table of contents')
      );
    }

    return {
      name: 'structure',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.structure,
      issues,
    };
  }

  private async evaluateCoverage(
    content: string,
    metadata?: QualityMetadata
  ): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    const wordCount = metadata?.wordCount || this.countWords(content);
    if (wordCount < 100) {
      score -= 40;
      issues.push(this.createIssue('coverage', 'critical', 'Content is too short'));
    } else if (wordCount < 300) {
      score -= 20;
      issues.push(this.createIssue('coverage', 'major', 'Content could be more comprehensive'));
    }

    const codeBlockCount = metadata?.codeBlockCount || this.countCodeBlocks(content);
    if (codeBlockCount === 0 && this.hasCodeRelatedContent(content)) {
      score -= 15;
      issues.push(this.createIssue('coverage', 'minor', 'Missing code examples'));
    }

    const linkCount = metadata?.linkCount || this.countLinks(content);
    if (linkCount === 0) {
      score -= 10;
      issues.push(this.createIssue('coverage', 'minor', 'No links to related content'));
    }

    return {
      name: 'coverage',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.coverage,
      issues,
    };
  }

  private async evaluateFreshness(metadata?: QualityMetadata): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    if (!metadata?.lastUpdated) {
      score -= 20;
      issues.push(this.createIssue('freshness', 'minor', 'Last update date is unknown'));
    } else {
      const daysSinceUpdate = this.daysSince(metadata.lastUpdated);
      if (daysSinceUpdate > 365) {
        score -= 30;
        issues.push(
          this.createIssue('freshness', 'major', 'Content has not been updated in over a year')
        );
      } else if (daysSinceUpdate > 180) {
        score -= 15;
        issues.push(this.createIssue('freshness', 'minor', 'Content may be outdated'));
      }
    }

    return {
      name: 'freshness',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.freshness,
      issues,
    };
  }

  private async evaluateConsistency(content: string): Promise<DimensionScore> {
    const issues: QualityIssue[] = [];
    let score = 100;

    const headingStyles = this.detectHeadingStyles(content);
    if (headingStyles.length > 1) {
      score -= 10;
      issues.push(this.createIssue('consistency', 'minor', 'Inconsistent heading styles detected'));
    }

    const listStyles = this.detectListStyles(content);
    if (listStyles.length > 2) {
      score -= 5;
      issues.push(this.createIssue('consistency', 'suggestion', 'Multiple list styles used'));
    }

    const codeBlockStyles = this.detectCodeBlockStyles(content);
    if (codeBlockStyles.length > 1) {
      score -= 5;
      issues.push(this.createIssue('consistency', 'suggestion', 'Inconsistent code block styles'));
    }

    return {
      name: 'consistency',
      score: Math.max(0, score),
      maxScore: 100,
      weight: DIMENSION_WEIGHTS.consistency,
      issues,
    };
  }

  private calculateOverallScore(dimensions: DimensionScore[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const dimension of dimensions) {
      totalScore += dimension.score * dimension.weight;
      totalWeight += dimension.weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private determineGrade(score: number): QualityGrade {
    if (score >= QUALITY_THRESHOLDS.gradeA) return 'A';
    if (score >= QUALITY_THRESHOLDS.gradeB) return 'B';
    if (score >= QUALITY_THRESHOLDS.gradeC) return 'C';
    if (score >= QUALITY_THRESHOLDS.gradeD) return 'D';
    return 'F';
  }

  private collectIssues(dimensions: DimensionScore[]): QualityIssue[] {
    return dimensions.flatMap((d) => d.issues);
  }

  private generateRecommendations(
    score: QualityScore,
    issues: QualityIssue[]
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    for (const issue of criticalIssues) {
      recommendations.push({
        priority: 'high',
        action: issue.suggestion || `Address: ${issue.message}`,
        impact: 'Critical for document quality',
        effort: 'medium',
      });
    }

    const majorIssues = issues.filter((i) => i.severity === 'major');
    for (const issue of majorIssues.slice(0, 3)) {
      recommendations.push({
        priority: 'medium',
        action: issue.suggestion || `Fix: ${issue.message}`,
        impact: 'Significant improvement to quality',
        effort: 'low',
      });
    }

    if (score.overall < 70) {
      recommendations.push({
        priority: 'high',
        action: 'Comprehensive review and update of the document',
        impact: 'Major quality improvement',
        effort: 'high',
      });
    }

    return recommendations;
  }

  private createIssue(
    dimension: QualityDimension,
    severity: QualityIssue['severity'],
    message: string
  ): QualityIssue {
    return {
      id: crypto.randomBytes(4).toString('hex'),
      dimension,
      severity,
      message,
    };
  }

  private hasSection(content: string, patterns: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return patterns.some((p) => lowerContent.includes(p));
  }

  private findBrokenLinkPatterns(content: string): string[] {
    const brokenPatterns: string[] = [];
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[2];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // External links would need actual checking
      } else if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        if (url.includes(' ')) {
          brokenPatterns.push(url);
        }
      }
    }

    return brokenPatterns;
  }

  private extractCodeBlocks(content: string): string[] {
    const blocks: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push(match[0]);
    }

    return blocks;
  }

  private hasSyntaxIssues(codeBlock: string): boolean {
    const openBraces = (codeBlock.match(/{/g) || []).length;
    const closeBraces = (codeBlock.match(/}/g) || []).length;

    return openBraces !== closeBraces;
  }

  private countWords(content: string): number {
    return content.split(/\s+/).filter((w) => w.length > 0).length;
  }

  private countComplexWords(content: string): number {
    const words = content.split(/\s+/);
    return words.filter((w) => w.length > 10).length;
  }

  private countLinks(content: string): number {
    return (content.match(/\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
  }

  private countCodeBlocks(content: string): number {
    return (content.match(/```/g) || []).length / 2;
  }

  private extractHeadings(content: string): Array<{ text: string; depth: number }> {
    const headings: Array<{ text: string; depth: number }> = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        text: match[2],
        depth: match[1].length,
      });
    }

    return headings;
  }

  private checkHeadingOrder(headings: Array<{ depth: number }>): { valid: boolean } {
    let prevDepth = 0;

    for (const heading of headings) {
      if (heading.depth > prevDepth + 1 && prevDepth > 0) {
        return { valid: false };
      }
      prevDepth = heading.depth;
    }

    return { valid: true };
  }

  private hasCodeRelatedContent(content: string): boolean {
    const codeKeywords = ['function', 'class', 'method', 'api', 'interface', 'type'];
    const lowerContent = content.toLowerCase();
    return codeKeywords.some((k) => lowerContent.includes(k));
  }

  private daysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private detectHeadingStyles(content: string): string[] {
    const styles = new Set<string>();
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('# ')) styles.add('atx-1');
      else if (line.startsWith('## ')) styles.add('atx-2');
      else if (line.startsWith('### ')) styles.add('atx-3');
    }

    return Array.from(styles);
  }

  private detectListStyles(content: string): string[] {
    const styles = new Set<string>();
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.match(/^[\*\-\+]\s/)) styles.add('unordered');
      else if (line.match(/^\d+\.\s/)) styles.add('ordered');
    }

    return Array.from(styles);
  }

  private detectCodeBlockStyles(content: string): string[] {
    const styles = new Set<string>();

    if (content.includes('```')) styles.add('fenced');
    if (content.match(/^ {4}/m)) styles.add('indented');

    return Array.from(styles);
  }

  private storeScore(pageId: string, score: QualityScore): void {
    if (!this.scoreHistory.has(pageId)) {
      this.scoreHistory.set(pageId, []);
    }
    this.scoreHistory.get(pageId)!.push(score);
  }

  private getPreviousScore(pageId: string): number | undefined {
    const history = this.scoreHistory.get(pageId);
    if (!history || history.length < 2) return undefined;
    return history[history.length - 2].overall;
  }

  private determineTrend(current: number, previous?: number): 'improving' | 'stable' | 'declining' {
    if (previous === undefined) return 'stable';
    const diff = current - previous;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }
}
