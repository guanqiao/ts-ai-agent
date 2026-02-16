import { LLMService } from '../../llm';
import {
  GeneratedSummary,
  SummaryConfig,
  SummaryStyle,
  SummaryLength,
  KeyPoint,
  ISummaryGenerator,
  DEFAULT_SUMMARY_CONFIG,
  LENGTH_LIMITS,
} from './types';

export class IntelligentSummaryGenerator implements ISummaryGenerator {
  private llmService: LLMService | null = null;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
  }

  async generateSummary(
    content: string,
    config?: Partial<SummaryConfig>
  ): Promise<GeneratedSummary> {
    const fullConfig: SummaryConfig = { ...DEFAULT_SUMMARY_CONFIG, ...config };
    const keyPoints = await this.extractKeyPoints(content, 5);

    let summary: string;

    if (this.llmService) {
      summary = await this.generateAISummary(content, keyPoints, fullConfig);
    } else {
      summary = this.generateHeuristicSummary(content, keyPoints, fullConfig);
    }

    summary = this.formatSummary(summary, fullConfig.style);
    summary = this.enforceLengthLimit(summary, fullConfig.length);

    const wordCount = this.countWords(summary);
    const readingTime = Math.ceil(wordCount / 200);

    return {
      text: summary,
      keyPoints: keyPoints.map((kp) => kp.text),
      wordCount,
      readingTime,
      type: fullConfig.type,
      confidence: this.llmService ? 0.9 : 0.7,
    };
  }

  async extractKeyPoints(content: string, maxPoints: number = 5): Promise<KeyPoint[]> {
    const keyPoints: KeyPoint[] = [];

    const headings = this.extractHeadings(content);
    for (const heading of headings.slice(0, maxPoints)) {
      keyPoints.push({
        text: heading,
        importance: 0.8,
        category: 'main',
      });
    }

    const firstParagraph = this.extractFirstParagraph(content);
    if (firstParagraph) {
      const sentences = this.extractImportantSentences(firstParagraph);
      for (const sentence of sentences.slice(0, 2)) {
        if (!keyPoints.some((kp) => kp.text === sentence)) {
          keyPoints.push({
            text: sentence,
            importance: 0.7,
            category: 'secondary',
          });
        }
      }
    }

    const codeBlocks = this.extractCodeBlockSummaries(content);
    for (const block of codeBlocks.slice(0, 2)) {
      keyPoints.push({
        text: block,
        importance: 0.6,
        category: 'detail',
      });
    }

    return keyPoints
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxPoints);
  }

  formatSummary(summary: string, style: SummaryStyle): string {
    switch (style) {
      case 'formal':
        return this.formatFormal(summary);
      case 'casual':
        return this.formatCasual(summary);
      case 'technical':
        return this.formatTechnical(summary);
      default:
        return summary;
    }
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  private async generateAISummary(
    content: string,
    keyPoints: KeyPoint[],
    config: SummaryConfig
  ): Promise<string> {
    if (!this.llmService) {
      return this.generateHeuristicSummary(content, keyPoints, config);
    }

    const lengthGuide = LENGTH_LIMITS[config.length];
    const keyPointsText = keyPoints.map((kp) => `- ${kp.text}`).join('\n');

    const prompt = `Generate a ${config.type} summary of the following content.

Key Points:
${keyPointsText}

Content:
${content.slice(0, 2000)}

Requirements:
- Maximum ${lengthGuide.words} words
- Style: ${config.style}
- Include key points: ${config.includeKeyPoints}
- Target audience: ${config.targetAudience || 'developers'}

Generate a concise, informative summary:`;

    try {
      const response = await this.llmService.complete([
        { role: 'user', content: prompt },
      ]);
      return response;
    } catch {
      return this.generateHeuristicSummary(content, keyPoints, config);
    }
  }

  private generateHeuristicSummary(
    content: string,
    keyPoints: KeyPoint[],
    config: SummaryConfig
  ): string {
    const lengthGuide = LENGTH_LIMITS[config.length];
    const parts: string[] = [];

    const title = this.extractTitle(content);
    if (title) {
      parts.push(`**${title}**`);
    }

    const firstParagraph = this.extractFirstParagraph(content);
    if (firstParagraph) {
      const truncated = this.truncateToSentences(firstParagraph, 2);
      parts.push(truncated);
    }

    if (config.includeKeyPoints && keyPoints.length > 0) {
      parts.push('\n\n**Key Points:**');
      for (const point of keyPoints.slice(0, 3)) {
        parts.push(`- ${point.text}`);
      }
    }

    let summary = parts.join('\n\n');
    summary = this.truncateToWordLimit(summary, lengthGuide.words);

    return summary;
  }

  private extractHeadings(content: string): string[] {
    const headings: string[] = [];
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1].trim());
    }

    return headings;
  }

  private extractFirstParagraph(content: string): string {
    const lines = content.split('\n');
    const paragraphLines: string[] = [];
    let inParagraph = false;

    for (const line of lines) {
      if (line.startsWith('#')) {
        if (inParagraph) break;
        continue;
      }

      if (line.trim().length > 0) {
        inParagraph = true;
        paragraphLines.push(line);
      } else if (inParagraph) {
        break;
      }
    }

    return paragraphLines.join(' ').trim();
  }

  private extractImportantSentences(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    return sentences
      .map((s) => s.trim())
      .filter((s) => {
        const lower = s.toLowerCase();
        return (
          lower.includes('is ') ||
          lower.includes('are ') ||
          lower.includes('provides') ||
          lower.includes('supports') ||
          lower.includes('enables')
        );
      });
  }

  private extractCodeBlockSummaries(content: string): string[] {
    const summaries: string[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'code';
      const code = match[2];
      const firstLine = code.split('\n')[0].trim();

      if (firstLine.length > 0 && firstLine.length < 50) {
        summaries.push(`${language}: ${firstLine}`);
      } else {
        summaries.push(`${language} code block`);
      }
    }

    return summaries;
  }

  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private truncateToSentences(text: string, maxSentences: number): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, maxSentences).join(' ');
  }

  private truncateToWordLimit(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;

    return words.slice(0, maxWords).join(' ') + '...';
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }

  private enforceLengthLimit(summary: string, length: SummaryLength): string {
    const limits = LENGTH_LIMITS[length];
    return this.truncateToWordLimit(summary, limits.words);
  }

  private formatFormal(summary: string): string {
    summary = summary.replace(/\bi\b/g, 'I');
    summary = summary.replace(/\bcan't\b/g, 'cannot');
    summary = summary.replace(/\bwon't\b/g, 'will not');
    summary = summary.replace(/\bdon't\b/g, 'do not');
    return summary;
  }

  private formatCasual(summary: string): string {
    return summary;
  }

  private formatTechnical(summary: string): string {
    const lines = summary.split('\n');
    const formatted: string[] = [];

    for (const line of lines) {
      if (line.includes(':') && !line.startsWith('-')) {
        formatted.push(`**${line}**`);
      } else {
        formatted.push(line);
      }
    }

    return formatted.join('\n');
  }
}
