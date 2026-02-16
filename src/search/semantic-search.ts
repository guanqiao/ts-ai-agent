import { LLMService } from '../llm';
import { ISemanticSearch, SearchDocument, SemanticSearchResult, EmbeddingConfig } from './types';

export class SemanticSearch implements ISemanticSearch {
  private llmService: LLMService | null = null;
  private documents: Map<string, SearchDocument> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private config: EmbeddingConfig;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
    this.config = {
      model: 'text-embedding-ada-002',
      dimensions: 1536,
      batchSize: 100,
    };
  }

  async index(documents: SearchDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }

    if (this.llmService) {
      const embeddings = await this.generateEmbeddings(documents.map((d) => d.content));
      for (let i = 0; i < documents.length; i++) {
        this.embeddings.set(documents[i].id, embeddings[i]);
      }
    }
  }

  async search(query: string, maxResults: number): Promise<SemanticSearchResult[]> {
    if (!this.llmService) {
      return [];
    }

    const queryEmbedding = await this.generateEmbedding(query);
    return this.searchByEmbedding(queryEmbedding, maxResults);
  }

  async searchByEmbedding(
    embedding: number[],
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];

    for (const [id, docEmbedding] of this.embeddings) {
      const score = this.cosineSimilarity(embedding, docEmbedding);
      results.push({
        documentId: id,
        score,
        embedding: docEmbedding,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  async removeDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    this.embeddings.delete(documentId);
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.embeddings.clear();
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  setConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getDocument(id: string): SearchDocument | undefined {
    return this.documents.get(id);
  }

  getEmbedding(id: string): number[] | undefined {
    return this.embeddings.get(id);
  }

  getDocumentCount(): number {
    return this.documents.size;
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

    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchEmbeddings = await Promise.all(batch.map((text) => this.generateEmbedding(text)));
      embeddings.push(...batchEmbeddings);
    }
    return embeddings;
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

  async findSimilar(documentId: string, maxResults: number): Promise<SemanticSearchResult[]> {
    const embedding = this.embeddings.get(documentId);
    if (!embedding) {
      return [];
    }

    const results = await this.searchByEmbedding(embedding, maxResults + 1);
    return results.filter((r) => r.documentId !== documentId).slice(0, maxResults);
  }

  async clusterDocuments(k: number): Promise<Map<number, string[]>> {
    const documentIds = Array.from(this.documents.keys());
    const embeddings = documentIds.map((id) => this.embeddings.get(id)!);

    const clusters = this.kMeansClustering(embeddings, k);

    const result = new Map<number, string[]>();
    for (let i = 0; i < documentIds.length; i++) {
      const clusterId = clusters[i];
      if (!result.has(clusterId)) {
        result.set(clusterId, []);
      }
      result.get(clusterId)!.push(documentIds[i]);
    }

    return result;
  }

  private kMeansClustering(embeddings: number[][], k: number): number[] {
    const n = embeddings.length;
    if (n === 0) return [];

    const dimensions = embeddings[0].length;
    const centroids: number[][] = [];
    const assignments: number[] = new Array(n).fill(0);

    for (let i = 0; i < k; i++) {
      centroids.push([...embeddings[Math.floor(Math.random() * n)]]);
    }

    for (let iter = 0; iter < 100; iter++) {
      let changed = false;

      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let minCluster = 0;

        for (let j = 0; j < k; j++) {
          const dist = 1 - this.cosineSimilarity(embeddings[i], centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            minCluster = j;
          }
        }

        if (assignments[i] !== minCluster) {
          assignments[i] = minCluster;
          changed = true;
        }
      }

      if (!changed) break;

      for (let j = 0; j < k; j++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          centroids[j] = this.computeCentroid(clusterPoints, dimensions);
        }
      }
    }

    return assignments;
  }

  private computeCentroid(points: number[][], dimensions: number): number[] {
    const centroid = new Array(dimensions).fill(0);
    for (const point of points) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += point[i];
      }
    }
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= points.length;
    }
    return this.normalizeVector(centroid);
  }
}
