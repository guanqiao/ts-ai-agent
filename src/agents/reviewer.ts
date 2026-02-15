import { BaseAgent, LLMService, SYSTEM_PROMPTS, PROMPT_TEMPLATES, renderTemplate } from '../llm';
import { AgentContext, AgentResult } from '../types';

export class ReviewAgent extends BaseAgent {
  readonly name = 'ReviewAgent';

  constructor(llmService: LLMService) {
    super(llmService);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      const previousResult = context.cache?.get('generatorResult') as string | undefined;

      if (!previousResult) {
        return this.createErrorResult('No document found to review');
      }

      const review = await this.reviewDocument(previousResult, context);
      const score = this.extractScore(review);
      const issues = this.extractIssues(review);

      return this.createSuccessResult(review, {
        score,
        issues,
        passed: score >= 7,
      });
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  private async reviewDocument(document: string, context: AgentContext): Promise<string> {
    const sourceSummary = context.parsedFiles
      .slice(0, 5)
      .map((f) => `${f.path}: ${f.symbols.length} symbols`)
      .join('\n');

    const prompt = renderTemplate(PROMPT_TEMPLATES.reviewDocument, {
      title: 'Technical Documentation',
      audience: '开发者',
      document: document.substring(0, 4000),
      sourceCode: sourceSummary,
    });

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.reviewer },
      { role: 'user' as const, content: prompt },
    ];

    return await this.llmService.complete(messages);
  }

  private extractScore(review: string): number {
    const scoreMatch = review.match(/评分[：:]\s*(\d+)/i) || review.match(/(\d+)\s*\/\s*10/);
    if (scoreMatch) {
      return parseInt(scoreMatch[1], 10);
    }

    const positiveWords = ['优秀', '良好', '完整', '准确', '清晰'];
    const negativeWords = ['缺失', '错误', '不完整', '模糊', '问题'];

    let score = 7;
    for (const word of positiveWords) {
      if (review.includes(word)) score += 0.5;
    }
    for (const word of negativeWords) {
      if (review.includes(word)) score -= 0.5;
    }

    return Math.max(1, Math.min(10, Math.round(score)));
  }

  private extractIssues(review: string): { severity: string; description: string }[] {
    const issues: { severity: string; description: string }[] = [];
    const lines = review.split('\n');

    let currentSeverity = 'info';

    for (const line of lines) {
      if (line.includes('严重') || line.includes('critical') || line.includes('重大')) {
        currentSeverity = 'critical';
      } else if (line.includes('中等') || line.includes('warning') || line.includes('建议')) {
        currentSeverity = 'warning';
      } else if (line.includes('轻微') || line.includes('info') || line.includes('小')) {
        currentSeverity = 'info';
      }

      if (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\./)) {
        issues.push({
          severity: currentSeverity,
          description: line.replace(/^[-*\d.]\s*/, ''),
        });
      }
    }

    return issues.slice(0, 20);
  }
}
