import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { LLMConfig, AgentMessage, AgentResult, AgentContext, LLMProvider } from '../types';
import { ILLMProvider, OpenAIProvider, AnthropicProvider } from './providers';
import { LLMCache, CacheConfig, DEFAULT_CACHE_CONFIG } from './cache';
import * as fs from 'fs';
import * as https from 'https';

export interface LLMServiceOptions {
  cache?: LLMCache<string>;
  cacheConfig?: Partial<CacheConfig>;
}

export class LLMService {
  private config: LLMConfig | null = null;
  private provider: ILLMProvider;
  private model: ChatOpenAI | null = null;
  private cache: LLMCache<string> | null = null;

  constructor(configOrProvider: LLMConfig | ILLMProvider, options: LLMServiceOptions = {}) {
    if (this.isProvider(configOrProvider)) {
      this.provider = configOrProvider;
      this.config = null;
    } else {
      this.config = configOrProvider;
      this.provider = this.createProvider(configOrProvider);
    }

    if (options.cache) {
      this.cache = options.cache;
    } else if (options.cacheConfig) {
      this.cache = new LLMCache<string>(options.cacheConfig);
    }
  }

  private isProvider(obj: unknown): obj is ILLMProvider {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'complete' in obj &&
      'stream' in obj &&
      'embed' in obj &&
      'getModel' in obj
    );
  }

  private createProvider(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case LLMProvider.OpenAI:
        return new OpenAIProvider(config);
      case LLMProvider.Anthropic:
        return new AnthropicProvider(config);
      default:
        return new OpenAIProvider(config);
    }
  }

  getProvider(): ILLMProvider {
    return this.provider;
  }

  async initialize(): Promise<void> {
    if (this.model) return;

    let httpAgent: https.Agent | undefined;

    if (this.config?.caCert) {
      const caCertContent = fs.readFileSync(this.config.caCert, 'utf-8');
      httpAgent = new https.Agent({
        ca: caCertContent,
      });
    }

    const configuration: Record<string, unknown> = {};
    if (this.config?.baseUrl) {
      configuration.baseURL = this.config.baseUrl;
    }
    if (httpAgent) {
      configuration.httpAgent = httpAgent;
    }

    this.model = new ChatOpenAI({
      modelName: this.config?.model || 'gpt-4',
      temperature: this.config?.temperature ?? 0.7,
      maxTokens: this.config?.maxTokens ?? 4096,
      openAIApiKey: this.config?.apiKey || process.env.OPENAI_API_KEY,
      configuration: Object.keys(configuration).length > 0 ? configuration : undefined,
    });
  }

  async complete(messages: AgentMessage[]): Promise<string> {
    const cacheKey = this.cache?.generateKey(
      JSON.stringify(messages),
      this.provider.getModel()
    );

    if (cacheKey && this.cache?.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const result = await this.provider.complete(messages);

    if (cacheKey) {
      this.cache?.set(cacheKey, result);
    }

    return result;
  }

  async *stream(messages: AgentMessage[]): AsyncIterable<string> {
    yield* this.provider.stream(messages);
  }

  getModel(): ChatOpenAI {
    if (!this.model) {
      throw new Error('LLM service not initialized');
    }
    return this.model;
  }

  async createEmbedding(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }

  getCacheStats(): { size: number; totalHits: number; hitRate: number } | null {
    if (!this.cache) return null;
    const stats = this.cache.getStats();
    return {
      size: stats.size,
      totalHits: stats.totalHits,
      hitRate: stats.hitRate,
    };
  }

  clearCache(): void {
    this.cache?.clear();
  }
}

export abstract class BaseAgent {
  abstract readonly name: string;
  protected llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected createSuccessResult(output: string, metadata?: Record<string, unknown>): AgentResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  protected createErrorResult(error: string): AgentResult {
    return {
      success: false,
      error,
    };
  }
}
