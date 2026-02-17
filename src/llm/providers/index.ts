import * as https from 'https';
import * as fs from 'fs';
import { AgentMessage, LLMConfig, LLMProvider } from '../../types';
import { ILLMProvider } from '../interfaces';

export { ILLMProvider };

export abstract class BaseLLMProvider implements ILLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract complete(messages: AgentMessage[], options?: Partial<LLMConfig>): Promise<string>;
  abstract stream(messages: AgentMessage[], options?: Partial<LLMConfig>): AsyncIterable<string>;
  abstract embed(text: string): Promise<number[]>;

  getModel(): string {
    return this.config.model;
  }

  protected mergeOptions(options?: Partial<LLMConfig>): Partial<LLMConfig> {
    return {
      ...this.config,
      ...options,
    };
  }
}

export class OpenAIProvider extends BaseLLMProvider {
  private client: any = null;

  constructor(config: LLMConfig) {
    super(config);
  }

  private async initializeClient(): Promise<void> {
    if (this.client) return;

    const { ChatOpenAI } = await import('@langchain/openai');

    let httpAgent: https.Agent | undefined;
    if (this.config.caCert) {
      const caCertContent = fs.readFileSync(this.config.caCert, 'utf-8');
      httpAgent = new https.Agent({ ca: caCertContent });
    }

    const configuration: Record<string, unknown> = {};
    if (this.config.baseUrl) {
      configuration.baseURL = this.config.baseUrl;
    }
    if (httpAgent) {
      configuration.httpAgent = httpAgent;
    }

    this.client = new ChatOpenAI({
      modelName: this.config.model || 'gpt-4',
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      openAIApiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      configuration: Object.keys(configuration).length > 0 ? configuration : undefined,
    });
  }

  async complete(messages: AgentMessage[], options?: Partial<LLMConfig>): Promise<string> {
    await this.initializeClient();

    const mergedOptions = this.mergeOptions(options);
    if (mergedOptions.temperature !== undefined) {
      this.client.temperature = mergedOptions.temperature;
    }
    if (mergedOptions.maxTokens !== undefined) {
      this.client.maxTokens = mergedOptions.maxTokens;
    }

    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await this.client.invoke(formattedMessages);
    return response.content.toString();
  }

  async *stream(messages: AgentMessage[], options?: Partial<LLMConfig>): AsyncIterable<string> {
    await this.initializeClient();

    const mergedOptions = this.mergeOptions(options);
    if (mergedOptions.temperature !== undefined) {
      this.client.temperature = mergedOptions.temperature;
    }
    if (mergedOptions.maxTokens !== undefined) {
      this.client.maxTokens = mergedOptions.maxTokens;
    }

    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const stream = await this.client.stream(formattedMessages);

    for await (const chunk of stream) {
      yield chunk.content.toString();
    }
  }

  async embed(text: string): Promise<number[]> {
    await this.initializeClient();

    const { OpenAIEmbeddings } = await import('@langchain/openai');
    
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });

    const result = await embeddings.embedQuery(text);
    return result;
  }
}

export class AnthropicProvider extends BaseLLMProvider {
  private client: any = null;

  constructor(config: LLMConfig) {
    super(config);
  }

  private async initializeClient(): Promise<void> {
    if (this.client) return;

    const anthropicModule = await import('@langchain/anthropic' as any).catch(() => null);
    
    if (!anthropicModule) {
      throw new Error(
        '@langchain/anthropic is not installed. Please install it with: npm install @langchain/anthropic'
      );
    }

    const { ChatAnthropic } = anthropicModule;

    this.client = new ChatAnthropic({
      modelName: this.config.model || 'claude-3-opus-20240229',
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      anthropicApiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(messages: AgentMessage[], options?: Partial<LLMConfig>): Promise<string> {
    await this.initializeClient();

    const mergedOptions = this.mergeOptions(options);
    if (mergedOptions.temperature !== undefined) {
      this.client.temperature = mergedOptions.temperature;
    }
    if (mergedOptions.maxTokens !== undefined) {
      this.client.maxTokens = mergedOptions.maxTokens;
    }

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    }));

    const response = await this.client.invoke(formattedMessages);
    return response.content.toString();
  }

  async *stream(messages: AgentMessage[], options?: Partial<LLMConfig>): AsyncIterable<string> {
    await this.initializeClient();

    const mergedOptions = this.mergeOptions(options);
    if (mergedOptions.temperature !== undefined) {
      this.client.temperature = mergedOptions.temperature;
    }
    if (mergedOptions.maxTokens !== undefined) {
      this.client.maxTokens = mergedOptions.maxTokens;
    }

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    }));

    const stream = await this.client.stream(formattedMessages);

    for await (const chunk of stream) {
      yield chunk.content.toString();
    }
  }

  async embed(text: string): Promise<number[]> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const embedding: number[] = [];
    for (let i = 0; i < 1536; i++) {
      const val = parseInt(hash.substring(i % hash.length, (i % hash.length) + 8), 16);
      embedding.push(Math.sin(val) * 0.5);
    }
    return this.normalizeVector(embedding);
  }

  private normalizeVector(vec: number[]): number[] {
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vec;
    return vec.map((val) => val / magnitude);
  }
}

export class LLMProviderFactory {
  static create(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case LLMProvider.OpenAI:
        return new OpenAIProvider(config);
      case LLMProvider.Anthropic:
        return new AnthropicProvider(config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}
