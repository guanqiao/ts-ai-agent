import { ILLMProvider, OpenAIProvider, AnthropicProvider, LLMProviderFactory } from '@llm/providers';
import { AgentMessage, LLMConfig, LLMProvider } from '@/types';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mock response' }),
    stream: jest.fn().mockImplementation(async function* () {
      yield { content: 'Mock ' };
      yield { content: 'stream' };
    }),
  })),
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  })),
}));

describe('LLM Providers', () => {
  describe('ILLMProvider Interface', () => {
    it('should define required methods', () => {
      const mockProvider: ILLMProvider = {
        complete: jest.fn(),
        stream: jest.fn(),
        embed: jest.fn(),
        getModel: jest.fn(),
      };

      expect(typeof mockProvider.complete).toBe('function');
      expect(typeof mockProvider.stream).toBe('function');
      expect(typeof mockProvider.embed).toBe('function');
      expect(typeof mockProvider.getModel).toBe('function');
    });
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    const mockConfig: LLMConfig = {
      provider: LLMProvider.OpenAI,
      model: 'gpt-4',
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 4096,
    };

    beforeEach(() => {
      provider = new OpenAIProvider(mockConfig);
    });

    it('should create instance with config', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should return model name', () => {
      expect(provider.getModel()).toBe('gpt-4');
    });

    it('should complete messages', async () => {
      const messages: AgentMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      const result = await provider.complete(messages);

      expect(typeof result).toBe('string');
      expect(result).toBe('Mock response');
    });

    it('should stream messages', async () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const chunks: string[] = [];
      for await (const chunk of provider.stream(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should generate embeddings', async () => {
      const text = 'Hello, world!';
      const embedding = await provider.embed(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;
    const mockConfig: LLMConfig = {
      provider: LLMProvider.Anthropic,
      model: 'claude-3-opus-20240229',
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 4096,
    };

    beforeEach(() => {
      provider = new AnthropicProvider(mockConfig);
    });

    it('should create instance with config', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should return model name', () => {
      expect(provider.getModel()).toBe('claude-3-opus-20240229');
    });

    it('should generate embeddings with hash-based approach', async () => {
      const text = 'Hello, world!';
      const embedding = await provider.embed(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('LLMProviderFactory', () => {
    it('should create OpenAI provider', () => {
      const config: LLMConfig = {
        provider: LLMProvider.OpenAI,
        model: 'gpt-4',
        apiKey: 'test-key',
      };

      const provider = LLMProviderFactory.create(config);

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Anthropic provider', () => {
      const config: LLMConfig = {
        provider: LLMProvider.Anthropic,
        model: 'claude-3-opus-20240229',
        apiKey: 'test-key',
      };

      const provider = LLMProviderFactory.create(config);

      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should throw error for unsupported provider', () => {
      const config = {
        provider: 'unsupported' as LLMProvider,
        model: 'test',
        apiKey: 'test-key',
      };

      expect(() => LLMProviderFactory.create(config)).toThrow();
    });
  });
});
