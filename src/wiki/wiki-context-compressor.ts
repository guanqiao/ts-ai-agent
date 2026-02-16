import { LLMService } from '../llm';
import { IContextCompressor, CompressedContext, ConversationMessage } from './types';

export class WikiContextCompressor implements IContextCompressor {
  private llmService: LLMService | null = null;
  private avgCharsPerToken: number = 4;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
  }

  async compress(context: string, targetTokens: number): Promise<CompressedContext> {
    const originalTokens = this.estimateTokens(context);

    if (originalTokens <= targetTokens) {
      return {
        summary: context,
        keyPoints: [],
        tokens: originalTokens,
        originalTokens,
        compressionRatio: 1,
      };
    }

    const keyPoints = await this.extractKeyPoints(context);
    const summary = await this.generateSummary(context, keyPoints, targetTokens);
    const compressedTokens = this.estimateTokens(summary);

    return {
      summary,
      keyPoints,
      tokens: compressedTokens,
      originalTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  async extractKeyPoints(context: string): Promise<string[]> {
    if (!this.llmService) {
      return this.extractKeyPointsLocally(context);
    }

    try {
      const messages = [
        {
          role: 'system' as const,
          content:
            'Extract the key points from the following context. Return a JSON array of strings, each being a key point.',
        },
        {
          role: 'user' as const,
          content: context,
        },
      ];

      const response = await this.llmService.complete(messages);
      const keyPoints = this.parseKeyPointsResponse(response);
      return keyPoints;
    } catch {
      return this.extractKeyPointsLocally(context);
    }
  }

  async summarizeHistory(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    if (!this.llmService) {
      return this.summarizeLocally(messages);
    }

    try {
      const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

      const llmMessages = [
        {
          role: 'system' as const,
          content:
            'Summarize the following conversation history concisely, preserving important decisions and context.',
        },
        {
          role: 'user' as const,
          content: conversationText,
        },
      ];

      return await this.llmService.complete(llmMessages);
    } catch {
      return this.summarizeLocally(messages);
    }
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.avgCharsPerToken);
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  private async generateSummary(
    context: string,
    keyPoints: string[],
    targetTokens: number
  ): Promise<string> {
    if (!this.llmService) {
      return this.generateLocalSummary(context, keyPoints, targetTokens);
    }

    try {
      const targetChars = targetTokens * this.avgCharsPerToken;
      const messages = [
        {
          role: 'system' as const,
          content: `Summarize the following context in approximately ${targetChars} characters or less. Focus on the key points provided.`,
        },
        {
          role: 'user' as const,
          content: `Key Points:\n${keyPoints.join('\n')}\n\nContext:\n${context}`,
        },
      ];

      return await this.llmService.complete(messages);
    } catch {
      return this.generateLocalSummary(context, keyPoints, targetTokens);
    }
  }

  private extractKeyPointsLocally(context: string): string[] {
    const keyPoints: string[] = [];
    const sentences = context.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    const importantPatterns = [
      /\b(important|critical|essential|key|main|primary|must|should|note)\b/i,
      /\b(function|class|interface|method|api|endpoint)\b/i,
      /\b(error|exception|warning|issue|bug)\b/i,
      /\b(config|setting|option|parameter)\b/i,
    ];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) continue;

      for (const pattern of importantPatterns) {
        if (pattern.test(trimmed)) {
          keyPoints.push(trimmed);
          break;
        }
      }

      if (keyPoints.length >= 10) break;
    }

    return keyPoints;
  }

  private generateLocalSummary(context: string, keyPoints: string[], targetTokens: number): string {
    const targetChars = targetTokens * this.avgCharsPerToken;

    if (keyPoints.length > 0) {
      const keyPointsText = keyPoints
        .slice(0, 5)
        .map((p) => `• ${p}`)
        .join('\n');

      if (keyPointsText.length <= targetChars) {
        return keyPointsText;
      }
    }

    const truncated = context.substring(0, targetChars);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace > 0 ? lastSpace : truncated.length) + '...';
  }

  private summarizeLocally(messages: ConversationMessage[]): string {
    const summaries: string[] = [];
    let currentRole: string | null = null;
    let currentContent: string[] = [];

    for (const msg of messages) {
      if (currentRole !== msg.role) {
        if (currentContent.length > 0) {
          const combinedContent = currentContent.join(' ');
          const truncated =
            combinedContent.length > 100
              ? combinedContent.substring(0, 100) + '...'
              : combinedContent;
          summaries.push(`${currentRole}: ${truncated}`);
        }
        currentRole = msg.role;
        currentContent = [msg.content];
      } else {
        currentContent.push(msg.content);
      }
    }

    if (currentContent.length > 0) {
      const combinedContent = currentContent.join(' ');
      const truncated =
        combinedContent.length > 100 ? combinedContent.substring(0, 100) + '...' : combinedContent;
      summaries.push(`${currentRole}: ${truncated}`);
    }

    return summaries.join('\n');
  }

  private parseKeyPointsResponse(response: string): string[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => typeof item === 'string');
        }
      }
    } catch {
      // Ignore parsing errors
    }

    const lines = response.split('\n').filter((line) => line.trim().length > 0);
    return lines
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((line) => line.length > 10)
      .slice(0, 10);
  }

  async compressWithContext(
    context: string,
    targetTokens: number,
    additionalContext?: string
  ): Promise<CompressedContext> {
    let fullContext = context;
    if (additionalContext) {
      fullContext = `${context}\n\nAdditional Context:\n${additionalContext}`;
    }
    return this.compress(fullContext, targetTokens);
  }

  async slidingWindowCompress(
    messages: ConversationMessage[],
    windowSize: number,
    targetTokens: number
  ): Promise<{ recentMessages: ConversationMessage[]; summary: string }> {
    if (messages.length <= windowSize) {
      return {
        recentMessages: messages,
        summary: '',
      };
    }

    const oldMessages = messages.slice(0, messages.length - windowSize);
    const recentMessages = messages.slice(messages.length - windowSize);
    const summary = await this.summarizeHistory(oldMessages);

    const compressedSummary = await this.compress(summary, targetTokens);

    return {
      recentMessages,
      summary: compressedSummary.summary,
    };
  }
}
