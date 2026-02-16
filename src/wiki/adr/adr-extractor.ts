import { ADRExtractionResult, IADRExtractor } from './types';

interface CodeDecision {
  title: string;
  context: string;
  decision: string;
  why?: string;
  alternatives?: string;
  consequences?: string;
  lineStart: number;
  lineEnd: number;
}

interface CommitDecision {
  title: string;
  context: string;
  decision: string;
  commitHash?: string;
  author?: string;
}

interface DocDecision {
  title: string;
  context: string;
  decision: string;
  section?: string;
  consequences?: string;
}

export class ADRExtractor implements IADRExtractor {
  private readonly decisionPatterns = [
    /@decision\s+(.+)/gi,
    /@architecture\s+(.+)/gi,
    /ARCHITECTURE\s+DECISION:\s*(.+)/gi,
    /DECISION:\s*(.+)/gi,
    /Design\s+Decision:\s*(.+)/gi,
  ];

  private readonly whyPatterns = [
    /@why\s+(.+)/gi,
    /Rationale:\s*(.+)/gi,
    /Why:\s*(.+)/gi,
    /Reason:\s*(.+)/gi,
  ];

  private readonly alternativePatterns = [
    /@alternative\s+(.+)/gi,
    /Alternatives?:\s*(.+)/gi,
    /Options?\s+Considered:\s*(.+)/gi,
  ];

  private readonly consequencePatterns = [
    /@consequence\s+(.+)/gi,
    /Consequences?:\s*(.+)/gi,
    /Impact:\s*(.+)/gi,
  ];

  private readonly decisionKeywords = [
    'decided to',
    'we decided',
    'the decision was made',
    'chose to',
    'selected',
    'opted for',
    'adopted',
    'implemented',
    'switched to',
    'migrated to',
    'replaced',
    'deprecated',
    'removed',
  ];

  async extractFromCode(filePath: string, content: string): Promise<ADRExtractionResult[]> {
    const results: ADRExtractionResult[] = [];
    const lines = content.split('\n');

    const decisions = this.extractDecisionsFromComments(lines);

    for (const decision of decisions) {
      const result: ADRExtractionResult = {
        adr: {
          title: decision.title,
          context: decision.context,
          decision: decision.decision,
          status: 'proposed',
          date: new Date(),
          decisionMakers: [],
          consequences: this.parseConsequences(decision.consequences),
          alternatives: this.parseAlternatives(decision.alternatives),
          links: [],
          codeReferences: [
            {
              filePath,
              lineStart: decision.lineStart,
              lineEnd: decision.lineEnd,
              snippet: lines.slice(decision.lineStart - 1, decision.lineEnd).join('\n'),
            },
          ],
          tags: this.extractTags(decision.decision),
          customFields: decision.why ? { rationale: decision.why } : {},
          createdBy: 'code-extraction',
          updatedBy: 'code-extraction',
        },
        source: 'code',
        sourcePath: filePath,
        confidence: this.calculateConfidence(decision),
        extractedAt: new Date(),
      };

      results.push(result);
    }

    return results;
  }

  private extractDecisionsFromComments(lines: string[]): CodeDecision[] {
    const decisions: CodeDecision[] = [];
    let inBlockComment = false;
    let blockCommentStart = 0;
    let currentBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('/**')) {
        inBlockComment = true;
        blockCommentStart = i + 1;
        currentBlock = [trimmedLine];
        if (trimmedLine.endsWith('*/')) {
          inBlockComment = false;
          const decision = this.parseBlockComment(
            currentBlock.join('\n'),
            blockCommentStart,
            i + 1
          );
          if (decision) {
            decisions.push(decision);
          }
          currentBlock = [];
        }
        continue;
      }

      if (inBlockComment) {
        currentBlock.push(trimmedLine);
        if (trimmedLine.endsWith('*/')) {
          inBlockComment = false;
          const decision = this.parseBlockComment(
            currentBlock.join('\n'),
            blockCommentStart,
            i + 1
          );
          if (decision) {
            decisions.push(decision);
          }
          currentBlock = [];
        }
        continue;
      }

      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
        const decision = this.parseLineComment(trimmedLine, i + 1);
        if (decision) {
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  private parseBlockComment(
    comment: string,
    lineStart: number,
    lineEnd: number
  ): CodeDecision | null {
    const cleanComment = comment
      .replace(/\/\*\*/g, '')
      .replace(/\*\//g, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();

    const decision = this.extractDecisionFromText(cleanComment);
    if (!decision) {
      return null;
    }

    return {
      ...decision,
      lineStart,
      lineEnd,
    };
  }

  private parseLineComment(line: string, lineNumber: number): CodeDecision | null {
    const cleanLine = line.replace(/^(\/\/|#)\s*/, '').trim();
    const decision = this.extractDecisionFromText(cleanLine);
    if (!decision) {
      return null;
    }

    return {
      ...decision,
      lineStart: lineNumber,
      lineEnd: lineNumber,
    };
  }

  private extractDecisionFromText(
    text: string
  ): Omit<CodeDecision, 'lineStart' | 'lineEnd'> | null {
    let decisionMatch: RegExpMatchArray | null = null;

    for (const pattern of this.decisionPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        decisionMatch = match;
        break;
      }
    }

    if (!decisionMatch) {
      const hasKeyword = this.decisionKeywords.some((keyword) =>
        text.toLowerCase().includes(keyword)
      );
      if (!hasKeyword) {
        return null;
      }

      const titleMatch = text.match(/^(.+?)(?:\.|:|\n)/);
      return {
        title: titleMatch ? titleMatch[1].trim() : 'Extracted Decision',
        context: '',
        decision: text,
        why: this.extractPattern(text, this.whyPatterns),
        alternatives: this.extractPattern(text, this.alternativePatterns),
        consequences: this.extractPattern(text, this.consequencePatterns),
      };
    }

    const title = decisionMatch[1].trim();

    return {
      title,
      context: '',
      decision: decisionMatch[1].trim(),
      why: this.extractPattern(text, this.whyPatterns),
      alternatives: this.extractPattern(text, this.alternativePatterns),
      consequences: this.extractPattern(text, this.consequencePatterns),
    };
  }

  private extractPattern(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  async extractFromCommits(
    commitMessages: string[],
    limit: number = 50
  ): Promise<ADRExtractionResult[]> {
    const results: ADRExtractionResult[] = [];
    const processedMessages = commitMessages.slice(0, limit);

    for (const message of processedMessages) {
      const decision = this.extractDecisionFromCommit(message);
      if (decision) {
        const result: ADRExtractionResult = {
          adr: {
            title: decision.title,
            context: decision.context,
            decision: decision.decision,
            status: 'accepted',
            date: new Date(),
            decisionMakers: decision.author ? [decision.author] : [],
            consequences: { positive: [], negative: [], neutral: [] },
            alternatives: [],
            links: [],
            codeReferences: [],
            tags: this.extractTags(decision.decision),
            customFields: decision.commitHash ? { commitHash: decision.commitHash } : {},
            createdBy: decision.author || 'commit-extraction',
            updatedBy: 'commit-extraction',
          },
          source: 'commit',
          sourcePath: decision.commitHash || 'unknown',
          confidence: this.calculateCommitConfidence(decision),
          extractedAt: new Date(),
        };

        results.push(result);
      }
    }

    return results;
  }

  private extractDecisionFromCommit(message: string): CommitDecision | null {
    const lines = message.split('\n');
    const firstLine = lines[0].trim();

    const conventionalMatch = firstLine.match(
      /^(feat|fix|refactor|perf|docs|style|test|chore)(\([^)]*\))?:\s*(.+)$/i
    );

    if (conventionalMatch) {
      const type = conventionalMatch[1];
      const scope = conventionalMatch[2]?.replace(/[()]/g, '') || '';
      const subject = conventionalMatch[3];

      const isArchitectural =
        type === 'feat' ||
        type === 'refactor' ||
        subject.toLowerCase().includes('architect') ||
        subject.toLowerCase().includes('design') ||
        subject.toLowerCase().includes('decision');

      if (!isArchitectural) {
        return null;
      }

      const title = scope ? `[${scope}] ${subject}` : subject;
      const body = lines.slice(1).join('\n').trim();

      return {
        title,
        context: this.extractContextFromBody(body),
        decision: subject,
        author: undefined,
        commitHash: undefined,
      };
    }

    const hasDecisionKeyword = this.decisionKeywords.some((keyword) =>
      firstLine.toLowerCase().includes(keyword)
    );

    if (hasDecisionKeyword) {
      const body = lines.slice(1).join('\n').trim();
      return {
        title: firstLine,
        context: this.extractContextFromBody(body),
        decision: firstLine,
        author: undefined,
        commitHash: undefined,
      };
    }

    return null;
  }

  private extractContextFromBody(body: string): string {
    const sections = body.split(/\n\n+/);
    for (const section of sections) {
      const lowerSection = section.toLowerCase();
      if (
        lowerSection.startsWith('why') ||
        lowerSection.startsWith('reason') ||
        lowerSection.startsWith('context') ||
        lowerSection.startsWith('background')
      ) {
        return section.replace(/^(why|reason|context|background):?\s*/i, '').trim();
      }
    }
    return '';
  }

  async extractFromDocs(docPath: string, content: string): Promise<ADRExtractionResult[]> {
    const results: ADRExtractionResult[] = [];
    const sections = this.parseDocumentSections(content);

    for (const section of sections) {
      if (this.isDecisionSection(section)) {
        const decision = this.extractDecisionFromSection(section);
        if (decision) {
          const result: ADRExtractionResult = {
            adr: {
              title: decision.title,
              context: decision.context,
              decision: decision.decision,
              status: 'accepted',
              date: new Date(),
              decisionMakers: [],
              consequences: this.parseConsequences(decision.consequences),
              alternatives: [],
              links: [],
              codeReferences: [],
              tags: this.extractTags(decision.decision),
              customFields: {},
              createdBy: 'doc-extraction',
              updatedBy: 'doc-extraction',
            },
            source: 'document',
            sourcePath: docPath,
            confidence: 0.8,
            extractedAt: new Date(),
          };

          results.push(result);
        }
      }
    }

    return results;
  }

  private parseDocumentSections(content: string): { title: string; content: string }[] {
    const sections: { title: string; content: string }[] = [];
    const lines = content.split('\n');
    let currentSection: { title: string; lines: string[] } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            content: currentSection.lines.join('\n').trim(),
          });
        }
        currentSection = {
          title: headerMatch[2].trim(),
          lines: [],
        };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }

    if (currentSection) {
      sections.push({
        title: currentSection.title,
        content: currentSection.lines.join('\n').trim(),
      });
    }

    return sections;
  }

  private isDecisionSection(section: { title: string; content: string }): boolean {
    const lowerTitle = section.title.toLowerCase();
    const decisionKeywords = [
      'decision',
      'architecture',
      'design',
      'adr',
      'rfc',
      'proposal',
      'choice',
      'selection',
    ];

    return decisionKeywords.some((keyword) => lowerTitle.includes(keyword));
  }

  private extractDecisionFromSection(section: {
    title: string;
    content: string;
  }): DocDecision | null {
    const hasDecisionContent = this.decisionKeywords.some(
      (keyword) =>
        section.title.toLowerCase().includes(keyword) ||
        section.content.toLowerCase().includes(keyword)
    );

    if (!hasDecisionContent) {
      return null;
    }

    return {
      title: section.title,
      context: '',
      decision: section.content.slice(0, 500),
      section: section.title,
      consequences: this.extractPattern(section.content, this.consequencePatterns),
    };
  }

  private parseConsequences(text?: string): {
    positive: string[];
    negative: string[];
    neutral: string[];
  } {
    if (!text) {
      return { positive: [], negative: [], neutral: [] };
    }

    const positive: string[] = [];
    const negative: string[] = [];
    const neutral: string[] = [];

    const lines = text.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const cleanLine = line.replace(/^[-*]\s*/, '').trim();
      if (
        cleanLine.toLowerCase().includes('positive') ||
        cleanLine.toLowerCase().includes('benefit')
      ) {
        positive.push(cleanLine);
      } else if (
        cleanLine.toLowerCase().includes('negative') ||
        cleanLine.toLowerCase().includes('drawback')
      ) {
        negative.push(cleanLine);
      } else {
        neutral.push(cleanLine);
      }
    }

    if (positive.length === 0 && negative.length === 0 && neutral.length === 0 && text.trim()) {
      neutral.push(text.trim());
    }

    return { positive, negative, neutral };
  }

  private parseAlternatives(
    text?: string
  ): { name: string; description: string; pros: string[]; cons: string[]; considered: boolean }[] {
    if (!text) {
      return [];
    }

    const alternatives: {
      name: string;
      description: string;
      pros: string[];
      cons: string[];
      considered: boolean;
    }[] = [];
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      const cleanLine = line.replace(/^[-*]\s*/, '').trim();
      if (cleanLine) {
        alternatives.push({
          name: cleanLine.slice(0, 50),
          description: cleanLine,
          pros: [],
          cons: [],
          considered: true,
        });
      }
    }

    return alternatives;
  }

  private extractTags(text: string): string[] {
    const tags: Set<string> = new Set();

    const techKeywords = [
      'typescript',
      'javascript',
      'react',
      'vue',
      'angular',
      'node',
      'api',
      'database',
      'authentication',
      'security',
      'performance',
      'testing',
      'deployment',
      'architecture',
      'design',
    ];

    const lowerText = text.toLowerCase();
    for (const keyword of techKeywords) {
      if (lowerText.includes(keyword)) {
        tags.add(keyword);
      }
    }

    return Array.from(tags).slice(0, 5);
  }

  private calculateConfidence(decision: CodeDecision): number {
    let confidence = 0.5;

    if (decision.title && decision.title.length > 5) confidence += 0.1;
    if (decision.context && decision.context.length > 10) confidence += 0.1;
    if (decision.decision && decision.decision.length > 10) confidence += 0.1;
    if (decision.why) confidence += 0.1;
    if (decision.alternatives) confidence += 0.1;
    if (decision.consequences) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private calculateCommitConfidence(decision: CommitDecision): number {
    let confidence = 0.6;

    if (decision.title.length > 10) confidence += 0.1;
    if (decision.context.length > 10) confidence += 0.15;
    if (decision.author) confidence += 0.05;
    if (decision.commitHash) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}
