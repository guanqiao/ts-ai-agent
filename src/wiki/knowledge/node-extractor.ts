import * as crypto from 'crypto';
import { WikiPage } from '../types';
import { KnowledgeNode, KnowledgeNodeMetadata } from './types';

export class NodeExtractor {
  private patternKeywords: Map<string, string[]>;

  constructor() {
    this.patternKeywords = new Map([
      ['singleton', ['singleton', 'getInstance', 'instance']],
      ['factory', ['factory', 'create', 'build']],
      ['observer', ['observer', 'subscribe', 'notify', 'emit', 'listener']],
      ['strategy', ['strategy', 'execute', 'algorithm']],
      ['decorator', ['decorator', 'wrap', 'enhance']],
      ['adapter', ['adapter', 'adapt', 'convert']],
      ['proxy', ['proxy', 'forward', 'intercept']],
      ['builder', ['builder', 'build', 'construct']],
      ['command', ['command', 'execute', 'undo', 'redo']],
      ['iterator', ['iterator', 'next', 'hasNext']],
      ['middleware', ['middleware', 'intercept', 'chain']],
      ['repository', ['repository', 'find', 'save', 'delete']],
      ['service', ['service', 'handle', 'process']],
    ]);
  }

  extractConcepts(pages: WikiPage[]): KnowledgeNode[] {
    const nodes: KnowledgeNode[] = [];
    const conceptMap = new Map<
      string,
      { count: number; pages: string[]; descriptions: string[] }
    >();

    for (const page of pages) {
      const concepts = this.extractConceptsFromPage(page);

      for (const concept of concepts) {
        const key = concept.name.toLowerCase();
        const existing = conceptMap.get(key);

        if (existing) {
          existing.count++;
          if (!existing.pages.includes(page.id)) {
            existing.pages.push(page.id);
          }
          if (concept.description && !existing.descriptions.includes(concept.description)) {
            existing.descriptions.push(concept.description);
          }
        } else {
          conceptMap.set(key, {
            count: 1,
            pages: [page.id],
            descriptions: concept.description ? [concept.description] : [],
          });
        }
      }
    }

    for (const [name, data] of conceptMap) {
      if (data.count >= 1 && name.length > 2) {
        const node = this.createConceptNode(
          name,
          data.descriptions.join('; '),
          data.pages,
          data.count
        );
        nodes.push(node);
      }
    }

    return nodes;
  }

  extractAPIs(pages: WikiPage[]): KnowledgeNode[] {
    const nodes: KnowledgeNode[] = [];
    const apiMap = new Map<
      string,
      { page: WikiPage; signatures: string[]; description?: string; apiType: string }
    >();

    for (const page of pages) {
      if (page.metadata.category === 'api' || page.metadata.category === 'reference') {
        const apis = this.extractAPIsFromPage(page);

        for (const api of apis) {
          const key = `${api.apiType}:${api.name}`;
          const existing = apiMap.get(key);

          if (existing) {
            existing.signatures.push(...api.signatures);
          } else {
            apiMap.set(key, {
              page,
              signatures: api.signatures,
              description: api.description,
              apiType: api.apiType,
            });
          }
        }
      }
    }

    for (const [key, data] of apiMap) {
      const [_apiType, name] = key.split(':');
      const node = this.createAPINode(
        name,
        data.apiType,
        data.signatures,
        data.page,
        data.description
      );
      nodes.push(node);
    }

    return nodes;
  }

  extractPatterns(pages: WikiPage[]): KnowledgeNode[] {
    const nodes: KnowledgeNode[] = [];
    const patternOccurrences = new Map<string, { pages: WikiPage[]; evidence: string[] }>();

    for (const page of pages) {
      const detectedPatterns = this.detectPatternsInPage(page);

      for (const pattern of detectedPatterns) {
        const existing = patternOccurrences.get(pattern.name);

        if (existing) {
          if (!existing.pages.some((p) => p.id === page.id)) {
            existing.pages.push(page);
          }
          existing.evidence.push(...pattern.evidence);
        } else {
          patternOccurrences.set(pattern.name, {
            pages: [page],
            evidence: pattern.evidence,
          });
        }
      }
    }

    for (const [patternName, data] of patternOccurrences) {
      if (data.pages.length >= 1) {
        const node = this.createPatternNode(patternName, data.pages, [...new Set(data.evidence)]);
        nodes.push(node);
      }
    }

    return nodes;
  }

  private extractConceptsFromPage(page: WikiPage): Array<{ name: string; description?: string }> {
    const concepts: Array<{ name: string; description?: string }> = [];
    const seen = new Set<string>();

    const headingPattern = /^(#{1,3})\s+(.+?)(?:\s*[-:]\s*(.+))?$/gm;
    let match;

    while ((match = headingPattern.exec(page.content)) !== null) {
      const name = match[2].trim();
      const description = match[3]?.trim();

      if (name.length > 2 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        concepts.push({ name, description });
      }
    }

    const boldPattern = /\*\*([^*]{3,30})\*\*/g;
    while ((match = boldPattern.exec(page.content)) !== null) {
      const name = match[1].trim();
      if (!seen.has(name.toLowerCase()) && !this.isCommonWord(name)) {
        seen.add(name.toLowerCase());
        concepts.push({ name });
      }
    }

    const codePattern = /`([a-zA-Z_][a-zA-Z0-9_-]*)`/g;
    while ((match = codePattern.exec(page.content)) !== null) {
      const name = match[1].trim();
      if (name.length > 3 && !seen.has(name.toLowerCase()) && !this.isCommonWord(name)) {
        seen.add(name.toLowerCase());
        concepts.push({ name });
      }
    }

    for (const tag of page.metadata.tags) {
      if (!seen.has(tag.toLowerCase()) && tag.length > 2) {
        seen.add(tag.toLowerCase());
        concepts.push({ name: tag });
      }
    }

    return concepts;
  }

  private extractAPIsFromPage(
    page: WikiPage
  ): Array<{ name: string; apiType: string; signatures: string[]; description?: string }> {
    const apis: Array<{
      name: string;
      apiType: string;
      signatures: string[];
      description?: string;
    }> = [];
    const seen = new Set<string>();

    const codeBlockPattern = /```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockPattern.exec(page.content)) !== null) {
      const code = match[1];
      const extractedAPIs = this.extractAPIsFromCode(code);

      for (const api of extractedAPIs) {
        const key = `${api.apiType}:${api.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          apis.push(api);
        }
      }
    }

    return apis;
  }

  private extractAPIsFromCode(
    code: string
  ): Array<{ name: string; apiType: string; signatures: string[]; description?: string }> {
    const apis: Array<{
      name: string;
      apiType: string;
      signatures: string[];
      description?: string;
    }> = [];

    const classPattern =
      /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g;
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      apis.push({
        name: match[1],
        apiType: 'class',
        signatures: [match[0].split('{')[0].trim()],
      });
    }

    const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/g;
    while ((match = interfacePattern.exec(code)) !== null) {
      apis.push({
        name: match[1],
        apiType: 'interface',
        signatures: [match[0].split('{')[0].trim()],
      });
    }

    const functionPattern =
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:\s*[^{=]+)?/g;
    while ((match = functionPattern.exec(code)) !== null) {
      apis.push({
        name: match[1],
        apiType: 'function',
        signatures: [match[0].trim()],
      });
    }

    const arrowFunctionPattern =
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g;
    while ((match = arrowFunctionPattern.exec(code)) !== null) {
      apis.push({
        name: match[1],
        apiType: 'function',
        signatures: [match[0].trim()],
      });
    }

    return apis;
  }

  private detectPatternsInPage(page: WikiPage): Array<{ name: string; evidence: string[] }> {
    const detectedPatterns: Array<{ name: string; evidence: string[] }> = [];
    const content = page.content.toLowerCase();

    for (const [patternName, keywords] of this.patternKeywords) {
      const evidence: string[] = [];
      let matchCount = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          matchCount += matches.length;
          evidence.push(`Found "${keyword}" ${matches.length} times`);
        }
      }

      if (matchCount >= 2) {
        detectedPatterns.push({
          name: patternName,
          evidence,
        });
      }
    }

    return detectedPatterns;
  }

  private createConceptNode(
    name: string,
    description: string,
    sourcePageIds: string[],
    frequency: number
  ): KnowledgeNode {
    const id = this.generateId('concept', name);
    const importance = Math.min(1, frequency / 10);

    const metadata: KnowledgeNodeMetadata = {
      tags: [name],
      stability: 'stable',
      importance,
    };

    return {
      id,
      type: 'concept',
      title: name,
      name,
      description,
      tags: [name],
      weight: frequency,
      relatedCount: sourcePageIds.length,
      importance,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createAPINode(
    name: string,
    apiType: string,
    _signatures: string[],
    _page: WikiPage,
    description?: string
  ): KnowledgeNode {
    const id = this.generateId('api', name);

    const metadata: KnowledgeNodeMetadata = {
      tags: [name, apiType],
      stability: 'stable',
      importance: 0.8,
    };

    return {
      id,
      type: 'api',
      title: name,
      name,
      description: description || `${apiType}: ${name}`,
      tags: [name, apiType],
      weight: 1,
      relatedCount: 1,
      importance: 0.8,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createPatternNode(name: string, pages: WikiPage[], _evidence: string[]): KnowledgeNode {
    const id = this.generateId('pattern', name);
    const importance = Math.min(1, pages.length * 0.3);

    const metadata: KnowledgeNodeMetadata = {
      tags: [name, 'design-pattern'],
      stability: 'stable',
      importance,
    };

    return {
      id,
      type: 'pattern',
      title: this.formatPatternName(name),
      name: this.formatPatternName(name),
      description: `Design pattern: ${name}. Detected in ${pages.length} page(s).`,
      tags: [name, 'design-pattern'],
      weight: pages.length,
      relatedCount: pages.length,
      importance,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private generateId(type: string, name: string): string {
    const hash = crypto.createHash('md5').update(`${type}:${name}`).digest('hex').substring(0, 8);
    return `kn-${type}-${hash}`;
  }

  private formatPatternName(name: string): string {
    return name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'dare',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      'they',
      'them',
      'their',
      'we',
      'us',
      'our',
      'you',
      'your',
      'he',
      'him',
      'his',
      'she',
      'her',
      'i',
      'me',
      'my',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'also',
      'now',
      'here',
      'there',
      'where',
      'which',
      'who',
      'whom',
      'what',
      'whose',
      'for',
      'from',
      'to',
      'of',
      'in',
      'on',
      'at',
      'by',
      'with',
      'about',
      'against',
      'between',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'true',
      'false',
      'null',
      'undefined',
      'void',
      'any',
      'string',
      'number',
      'boolean',
      'object',
      'array',
      'function',
      'class',
    ]);
    return commonWords.has(word.toLowerCase());
  }
}
