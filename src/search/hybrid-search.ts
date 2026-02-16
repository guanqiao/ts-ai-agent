import { LLMService } from '../llm';
import {
  ISearchEngine,
  SearchDocument,
  SearchResult,
  HybridSearchOptions,
  SearchFilter,
  SearchHighlight,
  KeywordSearchResult,
  SemanticSearchResult,
} from './types';
import { SemanticSearch } from './semantic-search';

export class HybridSearch implements ISearchEngine {
  private semanticSearch: SemanticSearch;
  private documents: Map<string, SearchDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();
  private documentTerms: Map<string, Map<string, number>> = new Map();

  constructor(llmService?: LLMService) {
    this.semanticSearch = new SemanticSearch(llmService);
  }

  async index(documents: SearchDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
      this.indexDocumentForKeyword(doc);
    }
    await this.semanticSearch.index(documents);
  }

  async indexDocument(doc: SearchDocument): Promise<void> {
    this.documents.set(doc.id, doc);
    this.indexDocumentForKeyword(doc);
    await this.semanticSearch.index([doc]);
  }

  private indexDocumentForKeyword(doc: SearchDocument): void {
    const terms = this.tokenize(doc.content);
    const termFrequency = new Map<string, number>();

    for (const term of terms) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Set());
      }
      this.invertedIndex.get(term)!.add(doc.id);

      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    }

    this.documentTerms.set(doc.id, termFrequency);
  }

  async search(query: string, options: HybridSearchOptions): Promise<SearchResult[]> {
    const keywordResults = this.keywordSearch(query, options.maxResults * 2);
    const semanticResults = await this.semanticSearch.search(query, options.maxResults * 2);

    const combinedResults = this.combineResults(
      keywordResults,
      semanticResults,
      options.keywordWeight,
      options.semanticWeight
    );

    let filteredResults = combinedResults;
    if (options.filters && options.filters.length > 0) {
      filteredResults = this.applyFilters(combinedResults, options.filters);
    }

    if (options.threshold > 0) {
      filteredResults = filteredResults.filter((r) => r.score >= options.threshold);
    }

    const finalResults = filteredResults.slice(0, options.maxResults);

    if (options.includeHighlights) {
      for (const result of finalResults) {
        result.highlights = this.generateHighlights(result.document, query);
      }
    }

    return finalResults;
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = this.documents.get(docId);
    if (doc) {
      const terms = this.tokenize(doc.content);
      for (const term of terms) {
        const docSet = this.invertedIndex.get(term);
        if (docSet) {
          docSet.delete(docId);
          if (docSet.size === 0) {
            this.invertedIndex.delete(term);
          }
        }
      }
      this.documentTerms.delete(docId);
    }
    this.documents.delete(docId);
    await this.semanticSearch.removeDocument(docId);
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.invertedIndex.clear();
    this.documentTerms.clear();
    await this.semanticSearch.clear();
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  setLLMService(llmService: LLMService): void {
    this.semanticSearch.setLLMService(llmService);
  }

  private keywordSearch(query: string, maxResults: number): KeywordSearchResult[] {
    const queryTerms = this.tokenize(query);
    const scores = new Map<string, number>();
    const matchedTerms = new Map<string, string[]>();
    const positions = new Map<string, { term: string; position: number }[]>();

    for (const term of queryTerms) {
      const docIds = this.invertedIndex.get(term);
      if (docIds) {
        for (const docId of docIds) {
          const tf = this.documentTerms.get(docId)?.get(term) || 0;
          const idf = Math.log(this.documents.size / docIds.size);
          const tfidf = tf * idf;

          scores.set(docId, (scores.get(docId) || 0) + tfidf);

          if (!matchedTerms.has(docId)) {
            matchedTerms.set(docId, []);
          }
          matchedTerms.get(docId)!.push(term);

          if (!positions.has(docId)) {
            positions.set(docId, []);
          }
          const doc = this.documents.get(docId);
          if (doc) {
            const pos = this.findTermPositions(doc.content, term);
            for (const p of pos) {
              positions.get(docId)!.push({ term, position: p });
            }
          }
        }
      }
    }

    const results: KeywordSearchResult[] = [];
    for (const [docId, score] of scores) {
      results.push({
        documentId: docId,
        score: score / queryTerms.length,
        matchedTerms: matchedTerms.get(docId) || [],
        positions: positions.get(docId) || [],
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  private combineResults(
    keywordResults: KeywordSearchResult[],
    semanticResults: SemanticSearchResult[],
    keywordWeight: number,
    semanticWeight: number
  ): SearchResult[] {
    const combinedScores = new Map<string, { keyword: number; semantic: number }>();

    for (const result of keywordResults) {
      combinedScores.set(result.documentId, {
        keyword: result.score,
        semantic: 0,
      });
    }

    for (const result of semanticResults) {
      const existing = combinedScores.get(result.documentId);
      if (existing) {
        existing.semantic = result.score;
      } else {
        combinedScores.set(result.documentId, {
          keyword: 0,
          semantic: result.score,
        });
      }
    }

    const results: SearchResult[] = [];
    for (const [docId, scores] of combinedScores) {
      const doc = this.documents.get(docId);
      if (doc) {
        const combinedScore =
          scores.keyword * keywordWeight + scores.semantic * semanticWeight;
        results.push({
          document: doc,
          score: combinedScore,
          searchType: 'hybrid',
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  private applyFilters(results: SearchResult[], filters: SearchFilter[]): SearchResult[] {
    return results.filter((result) => {
      for (const filter of filters) {
        const value = this.getFilterValue(result.document, filter.field);
        if (!this.matchesFilter(value, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  private getFilterValue(doc: SearchDocument, field: string): unknown {
    if (field.startsWith('metadata.')) {
      const metadataField = field.substring('metadata.'.length);
      return doc.metadata[metadataField as keyof typeof doc.metadata];
    }
    return doc[field as keyof SearchDocument];
  }

  private matchesFilter(value: unknown, filter: SearchFilter): boolean {
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'in':
        return Array.isArray(filter.value) && (filter.value as (string | number)[]).includes(value as string | number);
      case 'nin':
        return Array.isArray(filter.value) && !(filter.value as (string | number)[]).includes(value as string | number);
      case 'gt':
        return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
      case 'lt':
        return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
      case 'gte':
        return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
      case 'lte':
        return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value as string);
      default:
        return true;
    }
  }

  private generateHighlights(doc: SearchDocument, query: string): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const queryTerms = this.tokenize(query);

    const positions: { start: number; end: number }[] = [];
    const content = doc.content.toLowerCase();
    let snippet = '';

    for (const term of queryTerms) {
      const regex = new RegExp(`(.{0,50})(${term})(.{0,50})`, 'gi');
      const match = regex.exec(content);
      if (match) {
        snippet = match[0];
        const startIndex = match.index + match[1].length;
        positions.push({
          start: startIndex,
          end: startIndex + term.length,
        });
        break;
      }
    }

    if (snippet || positions.length > 0) {
      highlights.push({
        field: 'content',
        snippet: snippet || doc.content.substring(0, 100),
        positions,
      });
    }

    return highlights;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 1);
  }

  private findTermPositions(text: string, term: string): number[] {
    const positions: number[] = [];
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    let index = 0;

    while ((index = lowerText.indexOf(lowerTerm, index)) !== -1) {
      positions.push(index);
      index += lowerTerm.length;
    }

    return positions;
  }

  async getSuggestions(partialQuery: string, maxSuggestions: number): Promise<string[]> {
    const terms = this.tokenize(partialQuery);
    if (terms.length === 0) return [];

    const lastTerm = terms[terms.length - 1];
    const suggestions: string[] = [];

    for (const [term] of this.invertedIndex) {
      if (term.startsWith(lastTerm) && term !== lastTerm) {
        suggestions.push(term);
        if (suggestions.length >= maxSuggestions) break;
      }
    }

    return suggestions;
  }

  async getRelatedDocuments(docId: string, maxResults: number): Promise<SearchResult[]> {
    const doc = this.documents.get(docId);
    if (!doc) return [];

    const semanticResults = await this.semanticSearch.findSimilar(docId, maxResults * 2);

    const results: SearchResult[] = [];
    for (const result of semanticResults) {
      if (result.documentId !== docId) {
        const relatedDoc = this.documents.get(result.documentId);
        if (relatedDoc) {
          results.push({
            document: relatedDoc,
            score: result.score,
            searchType: 'semantic',
          });
        }
      }
    }

    return results.slice(0, maxResults);
  }
}
