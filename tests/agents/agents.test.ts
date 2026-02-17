import { AgentOrchestrator } from '../../src/agents/orchestrator';
import { CodeAnalysisAgent } from '../../src/agents/analyzer';
import { DocGeneratorAgent } from '../../src/agents/generator';
import { ReviewAgent } from '../../src/agents/reviewer';
import { LLMService } from '../../src/llm/base';
import { AgentContext, LLMConfig, SymbolKind, Language, CodeSymbol } from '../../src/types';

jest.mock('../../src/llm/base', () => {
  const originalModule = jest.requireActual('../../src/llm/base');
  return {
    ...originalModule,
    LLMService: jest.fn().mockImplementation(() => ({
      complete: jest.fn().mockResolvedValue('Mock LLM response'),
      initialize: jest.fn().mockResolvedValue(undefined),
      stream: jest.fn().mockImplementation(async function* () {
        yield 'Mock ';
        yield 'response';
      }),
      createEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.0258)),
      getModel: jest.fn(),
    })),
  };
});

function createMockSymbol(name: string, kind: SymbolKind, description?: string): CodeSymbol {
  return {
    name,
    kind,
    description,
    location: {
      file: '/test/file.ts',
      line: 1,
      endLine: 10,
    },
  };
}

function createParsedFile(path: string, symbols: CodeSymbol[] = []) {
  return {
    path,
    language: Language.TypeScript,
    symbols,
    imports: [] as any[],
    exports: [] as any[],
    parseTime: 100,
  };
}

describe('CodeAnalysisAgent', () => {
  let agent: CodeAnalysisAgent;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    mockLLMService = new LLMService({} as any) as jest.Mocked<LLMService>;
    mockLLMService.complete = jest.fn().mockResolvedValue('Mock analysis result');
    agent = new CodeAnalysisAgent(mockLLMService);
  });

  describe('constructor', () => {
    it('should create agent with correct name', () => {
      expect(agent.name).toBe('CodeAnalysisAgent');
    });
  });

  describe('execute', () => {
    it('should analyze parsed files successfully', async () => {
      const context: AgentContext = {
        parsedFiles: [createParsedFile('/test/file.ts', [createMockSymbol('TestClass', SymbolKind.Class)])],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.metadata?.totalFiles).toBe(1);
    });

    it('should handle empty file list', async () => {
      const context: AgentContext = {
        parsedFiles: [],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.totalFiles).toBe(0);
    });

    it('should handle files with raw content', async () => {
      const context: AgentContext = {
        parsedFiles: [{
          path: '/test/file.ts',
          language: Language.TypeScript,
          rawContent: 'const x = 1;',
          symbols: [],
          imports: [],
          exports: [],
          parseTime: 50,
        }],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
    });

    it('should return error on exception', async () => {
      mockLLMService.complete = jest.fn().mockRejectedValue(new Error('LLM error'));

      const context: AgentContext = {
        parsedFiles: [createParsedFile('/test/file.ts')],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM error');
    });
  });
});

describe('DocGeneratorAgent', () => {
  let agent: DocGeneratorAgent;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    mockLLMService = new LLMService({} as any) as jest.Mocked<LLMService>;
    mockLLMService.complete = jest.fn().mockResolvedValue('Mock documentation');
    agent = new DocGeneratorAgent(mockLLMService);
  });

  describe('constructor', () => {
    it('should create agent with correct name', () => {
      expect(agent.name).toBe('DocGeneratorAgent');
    });
  });

  describe('execute', () => {
    it('should generate documentation from analysis result', async () => {
      const context: AgentContext = {
        parsedFiles: [createParsedFile('/test/file.ts', [createMockSymbol('testFunction', SymbolKind.Function, 'A test function')])],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
        cache: new Map([['analysisResult', 'Test analysis result']]),
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });
});

describe('ReviewAgent', () => {
  let agent: ReviewAgent;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    mockLLMService = new LLMService({} as any) as jest.Mocked<LLMService>;
    mockLLMService.complete = jest.fn().mockResolvedValue('Mock review');
    agent = new ReviewAgent(mockLLMService);
  });

  describe('constructor', () => {
    it('should create agent with correct name', () => {
      expect(agent.name).toBe('ReviewAgent');
    });
  });

  describe('execute', () => {
    it('should review generated documentation', async () => {
      const context: AgentContext = {
        parsedFiles: [],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
        cache: new Map([
          ['analysisResult', 'Test analysis'],
          ['generatorResult', 'Generated documentation'],
        ]),
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });
});

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let llmConfig: LLMConfig;

  beforeEach(() => {
    llmConfig = {
      provider: 'openai' as any,
      model: 'gpt-4',
      apiKey: 'test-key',
      temperature: 0.7,
      maxTokens: 4096,
    };
    orchestrator = new AgentOrchestrator(llmConfig);
  });

  describe('constructor', () => {
    it('should create orchestrator with all agents', () => {
      expect(orchestrator).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run full agent pipeline', async () => {
      const context: AgentContext = {
        parsedFiles: [createParsedFile('/test/file.ts', [createMockSymbol('TestClass', SymbolKind.Class)])],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await orchestrator.run(context);

      expect(result).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.generation).toBeDefined();
      expect(result.finalDocument).toBeDefined();
    });
  });

  describe('analyzeOnly', () => {
    it('should run only analysis agent', async () => {
      const context: AgentContext = {
        parsedFiles: [],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await orchestrator.analyzeOnly(context);

      expect(result).toBeDefined();
    });
  });

  describe('generateOnly', () => {
    it('should run only generation agent with provided analysis', async () => {
      const context: AgentContext = {
        parsedFiles: [],
        options: { input: ['/test'], output: '/output' },
        workingDirectory: '/test',
      };

      const result = await orchestrator.generateOnly(context, 'Pre-computed analysis');

      expect(result).toBeDefined();
    });
  });
});
