import { LLMService } from '@llm/base';
import { ILLMProvider, OpenAIProvider, AnthropicProvider, LLMProviderFactory } from '@llm/providers';
import { AgentMessage, LLMConfig, LLMProvider } from '@/types';
import { LLMCache } from '@llm/cache';

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

describe('LLMService Refactored', () => {
  describe('with Provider', () => {
    let service: LLMService;
    const config: LLMConfig = {
      provider: LLMProvider.OpenAI,
      model: 'gpt-4',
      apiKey: 'test-key',
    };

    beforeEach(() => {
      service = new LLMService(config);
    });

    it('should create provider internally', () => {
      expect(service.getProvider()).toBeDefined();
      expect(service.getProvider()).toBeInstanceOf(OpenAIProvider);
    });

    it('should accept external provider', () => {
      const provider = new OpenAIProvider(config);
      const serviceWithProvider = new LLMService(provider);

      expect(serviceWithProvider.getProvider()).toBe(provider);
    });

    it('should delegate complete to provider', async () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = await service.complete(messages);

      expect(typeof result).toBe('string');
    });

    it('should delegate embed to provider', async () => {
      const text = 'Hello, world!';
      const embedding = await service.createEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });
  });

  describe('with Cache', () => {
    let service: LLMService;
    let cache: LLMCache<string>;
    const config: LLMConfig = {
      provider: LLMProvider.OpenAI,
      model: 'gpt-4',
      apiKey: 'test-key',
    };

    beforeEach(() => {
      cache = new LLMCache<string>({ enabled: true, ttlMs: 60000, maxSize: 100, persistToDisk: false });
      service = new LLMService(config, { cache });
    });

    it('should use cache for repeated requests', async () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Test cache' },
      ];

      await service.complete(messages);
      await service.complete(messages);

      const stats = service.getCacheStats();
      expect(stats?.totalHits).toBeGreaterThan(0);
    });

    it('should skip cache when disabled', async () => {
      const disabledCache = new LLMCache<string>({ enabled: false, persistToDisk: false });
      const serviceNoCache = new LLMService(config, { cache: disabledCache });

      const messages: AgentMessage[] = [
        { role: 'user', content: 'Test no cache' },
      ];

      await serviceNoCache.complete(messages);
      await serviceNoCache.complete(messages);

      const stats = serviceNoCache.getCacheStats();
      expect(stats?.totalHits).toBe(0);
    });
  });

  describe('stream', () => {
    it('should delegate stream to provider', async () => {
      const config: LLMConfig = {
        provider: LLMProvider.OpenAI,
        model: 'gpt-4',
        apiKey: 'test-key',
      };
      const service = new LLMService(config);

      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const chunks: string[] = [];
      for await (const chunk of service.stream(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Anthropic Provider', () => {
    it('should create Anthropic provider', () => {
      const config: LLMConfig = {
        provider: LLMProvider.Anthropic,
        model: 'claude-3-opus-20240229',
        apiKey: 'test-key',
      };

      const service = new LLMService(config);

      expect(service.getProvider()).toBeInstanceOf(AnthropicProvider);
    });
  });
});
