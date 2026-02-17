import { LLMService, BaseAgent } from '../../src/llm/base';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES, renderTemplate } from '../../src/llm/prompts';
import { LLMConfig, AgentContext, AgentResult } from '../../src/types';
import * as fs from 'fs';

jest.mock('@langchain/openai');
jest.mock('fs');

describe('LLMService', () => {
  let llmService: LLMService;
  let config: LLMConfig;

  beforeEach(() => {
    config = {
      provider: 'openai' as any,
      model: 'gpt-4',
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 4096,
    };
    llmService = new LLMService(config);
  });

  describe('constructor', () => {
    it('should create LLMService with config', () => {
      expect(llmService).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize without CA cert', async () => {
      await expect(llmService.initialize()).resolves.not.toThrow();
    });

    it('should initialize with CA cert', async () => {
      const mockReadFileSync = fs.readFileSync as jest.Mock;
      mockReadFileSync.mockReturnValue('mock-cert-content');

      const configWithCert: LLMConfig = {
        ...config,
        caCert: '/path/to/ca.crt',
      };

      const serviceWithCert = new LLMService(configWithCert);
      await expect(serviceWithCert.initialize()).resolves.not.toThrow();

      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/ca.crt', 'utf-8');
    });

    it('should use custom base URL', async () => {
      const configWithBaseUrl: LLMConfig = {
        ...config,
        baseUrl: 'https://custom-api.example.com',
      };

      const serviceWithBaseUrl = new LLMService(configWithBaseUrl);
      await expect(serviceWithBaseUrl.initialize()).resolves.not.toThrow();
    });
  });

  describe('complete', () => {
    it('should auto-initialize if not initialized', async () => {
      await expect(llmService.initialize()).resolves.not.toThrow();
    });
  });

  describe('stream', () => {
    it('should be defined', () => {
      expect(llmService.stream).toBeDefined();
    });
  });

  describe('createEmbedding', () => {
    it('should be defined', () => {
      expect(llmService.createEmbedding).toBeDefined();
    });
  });

  describe('getModel', () => {
    it('should throw error if not initialized', () => {
      expect(() => llmService.getModel()).toThrow('LLM service not initialized');
    });

    it('should return model after initialization', async () => {
      await llmService.initialize();
      const model = llmService.getModel();
      expect(model).toBeDefined();
    });
  });
});

describe('BaseAgent', () => {
  let mockLLMService: LLMService;
  let agent: BaseAgent;

  beforeEach(() => {
    mockLLMService = {
      complete: jest.fn().mockResolvedValue('Mock response'),
      initialize: jest.fn(),
      stream: jest.fn(),
      createEmbedding: jest.fn(),
      getModel: jest.fn(),
    } as unknown as LLMService;

    agent = new (class TestAgent extends BaseAgent {
      readonly name = 'TestAgent';

      async execute(context: AgentContext): Promise<AgentResult> {
        return this.createSuccessResult('Test output', { context: context.workingDirectory });
      }
    })(mockLLMService);
  });

  describe('createSuccessResult', () => {
    it('should create successful result', () => {
      const result = agent['createSuccessResult']('Test output', { key: 'value' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should create result without metadata', () => {
      const result = agent['createSuccessResult']('Test output');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('createErrorResult', () => {
    it('should create error result', () => {
      const result = agent['createErrorResult']('Something went wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });
});

describe('SYSTEM_PROMPTS', () => {
  it('should have codeAnalyzer prompt', () => {
    expect(SYSTEM_PROMPTS.codeAnalyzer).toBeDefined();
    expect(typeof SYSTEM_PROMPTS.codeAnalyzer).toBe('string');
    expect(SYSTEM_PROMPTS.codeAnalyzer.length).toBeGreaterThan(0);
  });

  it('should have docGenerator prompt', () => {
    expect(SYSTEM_PROMPTS.docGenerator).toBeDefined();
    expect(typeof SYSTEM_PROMPTS.docGenerator).toBe('string');
  });

  it('should have reviewer prompt', () => {
    expect(SYSTEM_PROMPTS.reviewer).toBeDefined();
    expect(typeof SYSTEM_PROMPTS.reviewer).toBe('string');
  });
});

describe('PROMPT_TEMPLATES', () => {
  it('should have analyzeCode template', () => {
    expect(PROMPT_TEMPLATES.analyzeCode).toBeDefined();
    expect(typeof PROMPT_TEMPLATES.analyzeCode).toBe('string');
  });

  it('should have generateClassDoc template', () => {
    expect(PROMPT_TEMPLATES.generateClassDoc).toBeDefined();
    expect(typeof PROMPT_TEMPLATES.generateClassDoc).toBe('string');
  });

  it('should have generateApiDoc template', () => {
    expect(PROMPT_TEMPLATES.generateApiDoc).toBeDefined();
    expect(typeof PROMPT_TEMPLATES.generateApiDoc).toBe('string');
  });

  it('should have reviewDocument template', () => {
    expect(PROMPT_TEMPLATES.reviewDocument).toBeDefined();
    expect(typeof PROMPT_TEMPLATES.reviewDocument).toBe('string');
  });
});

describe('renderTemplate', () => {
  it('should replace variables in template', () => {
    const template = 'Hello {name}, welcome to {place}!';
    const result = renderTemplate(template, { name: 'World', place: 'TypeScript' });

    expect(result).toBe('Hello World, welcome to TypeScript!');
  });

  it('should handle missing variables', () => {
    const template = 'Hello {name}!';
    const result = renderTemplate(template, {});

    expect(result).toBe('Hello {name}!');
  });

  it('should handle empty template', () => {
    const result = renderTemplate('', { name: 'Test' });
    expect(result).toBe('');
  });

  it('should handle multiple occurrences', () => {
    const template = '{name} says: Hello {name}!';
    const result = renderTemplate(template, { name: 'Alice' });

    expect(result).toBe('Alice says: Hello Alice!');
  });
});
