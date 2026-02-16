import * as path from 'path';
import * as fs from 'fs';
import { LLMService } from '../llm';
import {
  IVectorStore,
  SearchDocument,
  SearchResult,
  EmbeddingConfig,
} from '../search/types';

export class WikiVectorStore implements IVectorStore {
  private llmService: LLMService | null = null;
  private documents: Map<string, SearchDocument> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private config: EmbeddingConfig;
  private initialized: boolean = false;
  private storagePath: string;

  constructor(projectPath: string, llmService?: LLMService) {
    this.llmService = llmService || null;
    this.storagePath = path.join(projectPath, '.wiki', 'vectors');
    this.config = {
      model: 'text-embedding-ada-002',
      dimensions: 1536,
      batchSize: 100,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    await this.loadFromDisk();

    this.initialized = true;
  }

  async addDocument(doc: SearchDocument): Promise<void> {
    this.documents.set(doc.id, doc);

    if (doc.embedding) {
      this.embeddings.set(doc.id, doc.embedding);
    } else if (this.llmService && doc.content) {
      const embedding = await this.generateEmbedding(doc.content);
      doc.embedding = embedding;
      this.embeddings.set(doc.id, embedding);
    }

    await this.saveToDisk();
  }

  async addDocuments(docs: SearchDocument[]): Promise<void> {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }

    if (this.llmService) {
      const contents = docs.map((d) => d.content);
      const embeddings = await this.generateEmbeddings(contents);

      for (let i = 0; i < docs.length; i++) {
        docs[i].embedding = embeddings[i];
        this.embeddings.set(docs[i].id, embeddings[i]);
      }
    }

    await this.saveToDisk();
  }

  async removeDocument(id: string): Promise<void> {
    this.documents.delete(id);
    this.embeddings.delete(id);
    await this.saveToDisk();
  }

  async search(_query: string, k: number): Promise<SearchResult[]> {
    if (!this.llmService) {
      return this.searchByKeyword(_query, k);
    }

    const queryEmbedding = await this.generateEmbedding(_query);
    return this.similaritySearch(queryEmbedding, k);
  }

  async similaritySearch(embedding: number[], k: number): Promise<SearchResult[]> {
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, docEmbedding] of this.embeddings) {
      const score = this.cosineSimilarity(embedding, docEmbedding);
      results.push({ id, score });
    }

    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, k);

    return topResults.map((result) => ({
      document: this.documents.get(result.id)!,
      score: result.score,
      searchType: 'semantic' as const,
    }));
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.embeddings.clear();
    await this.saveToDisk();
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  setConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.llmService) {
      return this.generateRandomEmbedding();
    }

    try {
      const response = await this.llmService.createEmbedding(text);
      return response;
    } catch {
      return this.generateRandomEmbedding();
    }
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.llmService) {
      return texts.map(() => this.generateRandomEmbedding());
    }

    try {
      const embeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += this.config.batchSize) {
        const batch = texts.slice(i, i + this.config.batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map((text) => this.generateEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);
      }
      return embeddings;
    } catch {
      return texts.map(() => this.generateRandomEmbedding());
    }
  }

  private generateRandomEmbedding(): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < this.config.dimensions; i++) {
      embedding.push(Math.random() * 2 - 1);
    }
    return this.normalizeVector(embedding);
  }

  private normalizeVector(vec: number[]): number[] {
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vec;
    return vec.map((val) => val / magnitude);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async searchByKeyword(query: string, k: number): Promise<SearchResult[]> {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, doc] of this.documents) {
      const content = doc.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = content.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      if (score > 0) {
        results.push({ id, score: score / queryTerms.length });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, k).map((result) => ({
      document: this.documents.get(result.id)!,
      score: result.score,
      searchType: 'keyword' as const,
    }));
  }

  private async saveToDisk(): Promise<void> {
    const documentsPath = path.join(this.storagePath, 'documents.json');
    const embeddingsPath = path.join(this.storagePath, 'embeddings.json');

    const documentsObj: Record<string, SearchDocument> = {};
    for (const [id, doc] of this.documents) {
      documentsObj[id] = doc;
    }

    const embeddingsObj: Record<string, number[]> = {};
    for (const [id, embedding] of this.embeddings) {
      embeddingsObj[id] = embedding;
    }

    fs.writeFileSync(documentsPath, JSON.stringify(documentsObj, null, 2));
    fs.writeFileSync(embeddingsPath, JSON.stringify(embeddingsObj));
  }

  private async loadFromDisk(): Promise<void> {
    const documentsPath = path.join(this.storagePath, 'documents.json');
    const embeddingsPath = path.join(this.storagePath, 'embeddings.json');

    if (fs.existsSync(documentsPath)) {
      const data = JSON.parse(fs.readFileSync(documentsPath, 'utf-8'));
      for (const [id, doc] of Object.entries(data)) {
        this.documents.set(id, doc as SearchDocument);
      }
    }

    if (fs.existsSync(embeddingsPath)) {
      const data = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
      for (const [id, embedding] of Object.entries(data)) {
        this.embeddings.set(id, embedding as number[]);
      }
    }
  }

  getDocument(id: string): SearchDocument | undefined {
    return this.documents.get(id);
  }

  getEmbedding(id: string): number[] | undefined {
    return this.embeddings.get(id);
  }

  getAllDocuments(): SearchDocument[] {
    return Array.from(this.documents.values());
  }
}
