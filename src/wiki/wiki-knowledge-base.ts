import { LLMService } from '../llm';
import { IWikiKnowledgeBase, WikiDocument, WikiPage, WikiAnswer } from './types';

interface SearchIndex {
  pageId: string;
  keywords: Set<string>;
  summary: string;
  sections: { title: string; content: string }[];
}

export class WikiKnowledgeBase implements IWikiKnowledgeBase {
  private llmService: LLMService | null = null;
  private pages: Map<string, WikiPage> = new Map();
  private searchIndex: Map<string, SearchIndex> = new Map();
  private pageLinks: Map<string, Set<string>> = new Map();

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
  }

  async index(document: WikiDocument): Promise<void> {
    this.pages.clear();
    this.searchIndex.clear();
    this.pageLinks.clear();

    for (const page of document.pages) {
      this.pages.set(page.id, page);
      this.buildSearchIndex(page);
      this.extractLinks(page);
    }
  }

  async query(question: string): Promise<WikiAnswer> {
    const relevantPages = this.findRelevantPages(question);

    if (relevantPages.length === 0) {
      return {
        question,
        answer: 'No relevant information found in the wiki.',
        relatedPages: [],
        confidence: 0,
        sources: [],
      };
    }

    if (this.llmService) {
      return this.queryWithLLM(question, relevantPages);
    }

    return this.queryWithKeywordMatch(question, relevantPages);
  }

  async search(keywords: string[]): Promise<WikiPage[]> {
    const results: { page: WikiPage; score: number }[] = [];

    for (const [pageId, index] of this.searchIndex) {
      let score = 0;
      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (index.keywords.has(lowerKeyword)) {
          score += 1;
        }

        for (const section of index.sections) {
          if (section.content.toLowerCase().includes(lowerKeyword)) {
            score += 0.5;
          }
        }
      }

      if (score > 0) {
        const page = this.pages.get(pageId);
        if (page) {
          results.push({ page, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 10).map((r) => r.page);
  }

  async getRelatedPages(pageId: string): Promise<WikiPage[]> {
    const relatedIds = this.pageLinks.get(pageId);
    if (!relatedIds) return [];

    const related: WikiPage[] = [];
    for (const id of relatedIds) {
      const page = this.pages.get(id);
      if (page) {
        related.push(page);
      }
    }

    return related;
  }

  async getContext(topic: string): Promise<string> {
    const pages = await this.search([topic]);

    if (pages.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    for (const page of pages.slice(0, 3)) {
      contextParts.push(`## ${page.title}\n\n${page.content.slice(0, 500)}...`);
    }

    return contextParts.join('\n\n---\n\n');
  }

  setLLMService(service: LLMService): void {
    this.llmService = service;
  }

  private buildSearchIndex(page: WikiPage): void {
    const keywords = new Set<string>();

    const titleWords = page.title.toLowerCase().split(/\s+/);
    titleWords.forEach((w) => keywords.add(w));

    const contentWords = page.content.toLowerCase().split(/\s+/);
    contentWords.forEach((w) => {
      if (w.length > 3) {
        keywords.add(w);
      }
    });

    page.metadata.tags.forEach((t) => keywords.add(t.toLowerCase()));

    const sections: { title: string; content: string }[] = [];
    const sectionPattern = /^## (.+)$/gm;
    let match;
    let lastIndex = 0;
    const content = page.content;

    while ((match = sectionPattern.exec(content)) !== null) {
      if (lastIndex > 0) {
        sections.push({
          title: content.slice(lastIndex, match.index).split('\n')[0].replace(/^## /, ''),
          content: content.slice(lastIndex, match.index),
        });
      }
      lastIndex = match.index;
    }

    if (lastIndex < content.length) {
      sections.push({
        title: content.slice(lastIndex).split('\n')[0].replace(/^## /, ''),
        content: content.slice(lastIndex),
      });
    }

    const summary = this.extractSummary(page.content);

    this.searchIndex.set(page.id, {
      pageId: page.id,
      keywords,
      summary,
      sections,
    });
  }

  private extractLinks(page: WikiPage): void {
    const links = new Set<string>();

    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkPattern.exec(page.content)) !== null) {
      const target = match[2];
      if (!target.startsWith('http')) {
        const targetPage = this.findPageBySlug(target);
        if (targetPage) {
          links.add(targetPage.id);
        }
      }
    }

    for (const link of page.links) {
      if (link.type === 'internal') {
        const targetPage = this.findPageBySlug(link.target);
        if (targetPage) {
          links.add(targetPage.id);
        }
      }
    }

    this.pageLinks.set(page.id, links);
  }

  private findPageBySlug(slug: string): WikiPage | null {
    for (const page of this.pages.values()) {
      if (page.slug === slug) {
        return page;
      }
    }
    return null;
  }

  private findRelevantPages(question: string): WikiPage[] {
    const questionWords = question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scores: { pageId: string; score: number }[] = [];

    for (const [pageId, index] of this.searchIndex) {
      let score = 0;

      for (const word of questionWords) {
        if (index.keywords.has(word)) {
          score += 1;
        }

        if (index.summary.toLowerCase().includes(word)) {
          score += 2;
        }

        for (const section of index.sections) {
          if (section.title.toLowerCase().includes(word)) {
            score += 3;
          }
          if (section.content.toLowerCase().includes(word)) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        scores.push({ pageId, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    return scores
      .slice(0, 5)
      .map((s) => this.pages.get(s.pageId)!)
      .filter(Boolean);
  }

  private async queryWithLLM(question: string, pages: WikiPage[]): Promise<WikiAnswer> {
    if (!this.llmService) {
      return this.queryWithKeywordMatch(question, pages);
    }

    const context = pages
      .map((p) => `## ${p.title}\n\n${p.content.slice(0, 1000)}`)
      .join('\n\n---\n\n');

    const prompt = `Based on the following wiki content, please answer the question.

Wiki Content:
${context}

Question: ${question}

Please provide a clear and concise answer based on the wiki content. If the information is not available in the wiki, say so.`;

    try {
      const response = await this.llmService.complete([{ role: 'user', content: prompt }]);

      return {
        question,
        answer: response,
        relatedPages: pages.map((p) => p.id),
        confidence: 0.8,
        sources: pages.slice(0, 3).map((p) => ({
          pageId: p.id,
          pageTitle: p.title,
          relevance: 1,
          excerpt: this.extractSummary(p.content),
        })),
      };
    } catch {
      return this.queryWithKeywordMatch(question, pages);
    }
  }

  private queryWithKeywordMatch(question: string, pages: WikiPage[]): WikiAnswer {
    const relevantSections: { page: WikiPage; section: string }[] = [];

    for (const page of pages) {
      const index = this.searchIndex.get(page.id);
      if (index) {
        for (const section of index.sections) {
          relevantSections.push({
            page,
            section: `### ${section.title}\n\n${section.content.slice(0, 300)}`,
          });
        }
      }
    }

    const answer = relevantSections
      .slice(0, 3)
      .map((rs) => rs.section)
      .join('\n\n');

    return {
      question,
      answer: answer || 'No relevant information found.',
      relatedPages: pages.map((p) => p.id),
      confidence: 0.5,
      sources: pages.slice(0, 3).map((p) => ({
        pageId: p.id,
        pageTitle: p.title,
        relevance: 1,
        excerpt: this.extractSummary(p.content),
      })),
    };
  }

  private extractSummary(content: string): string {
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.slice(0, 200);
  }
}
