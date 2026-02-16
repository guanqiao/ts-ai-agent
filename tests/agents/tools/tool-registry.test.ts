import { ToolRegistry } from '../../../src/agents/tools/tool-registry';
import { BaseTool } from '../../../src/agents/tools/base-tool';
import { Tool, ToolResult, ToolContext, ToolParameter } from '../../../src/agents/tools/types';

class MockTool extends BaseTool {
  readonly name = 'mock_tool';
  readonly description = 'A mock tool for testing';
  readonly parameters: ToolParameter[] = [
    {
      name: 'input',
      type: 'string',
      description: 'Input string',
      required: true,
    },
    {
      name: 'count',
      type: 'number',
      description: 'Count number',
      required: false,
      defaultValue: 1,
    },
  ];

  async execute(context: ToolContext): Promise<ToolResult> {
    const input = context.params.input as string;
    const count = (context.params.count as number) || 1;

    return {
      success: true,
      data: { result: input.repeat(count) },
      metadata: { executionTime: 10 },
    };
  }
}

class ErrorTool extends BaseTool {
  readonly name = 'error_tool';
  readonly description = 'A tool that always errors';
  readonly parameters: ToolParameter[] = [];

  async execute(_context: ToolContext): Promise<ToolResult> {
    return {
      success: false,
      error: 'Intentional error for testing',
    };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.has('mock_tool')).toBe(true);
    });

    it('should throw error when registering duplicate tool', () => {
      const tool1 = new MockTool();
      const tool2 = new MockTool();

      registry.register(tool1);

      expect(() => registry.register(tool2)).toThrow('Tool already registered: mock_tool');
    });

    it('should register multiple different tools', () => {
      const mockTool = new MockTool();
      const errorTool = new ErrorTool();

      registry.register(mockTool);
      registry.register(errorTool);

      expect(registry.size).toBe(2);
      expect(registry.has('mock_tool')).toBe(true);
      expect(registry.has('error_tool')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return tool by name', () => {
      const tool = new MockTool();
      registry.register(tool);

      const retrieved = registry.get('mock_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('mock_tool');
    });

    it('should return undefined for non-existent tool', () => {
      const retrieved = registry.get('non_existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.has('mock_tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('list', () => {
    it('should return empty array when no tools registered', () => {
      const tools = registry.list();

      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const mockTool = new MockTool();
      const errorTool = new ErrorTool();

      registry.register(mockTool);
      registry.register(errorTool);

      const tools = registry.list();

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('mock_tool');
      expect(tools.map(t => t.name)).toContain('error_tool');
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      registry.unregister('mock_tool');

      expect(registry.has('mock_tool')).toBe(false);
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => registry.unregister('non_existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      const mockTool = new MockTool();
      const errorTool = new ErrorTool();

      registry.register(mockTool);
      registry.register(errorTool);

      registry.clear();

      expect(registry.size).toBe(0);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return tool definitions for LLM', () => {
      const tool = new MockTool();
      registry.register(tool);

      const definitions = registry.getToolDefinitions();

      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toEqual({
        name: 'mock_tool',
        description: 'A mock tool for testing',
        parameters: [
          {
            name: 'input',
            type: 'string',
            description: 'Input string',
            required: true,
          },
          {
            name: 'count',
            type: 'number',
            description: 'Count number',
            required: false,
            defaultValue: 1,
          },
        ],
      });
    });
  });
});

describe('BaseTool', () => {
  let tool: MockTool;

  beforeEach(() => {
    tool = new MockTool();
  });

  describe('validateParameters', () => {
    it('should pass validation with required parameters', () => {
      const result = tool.validateParameters({ input: 'test' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation when missing required parameter', () => {
      const result = tool.validateParameters({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: input');
    });

    it('should use default value for optional parameter', () => {
      const result = tool.validateParameters({ input: 'test' });

      expect(result.valid).toBe(true);
    });

    it('should validate parameter types', () => {
      const result = tool.validateParameters({ input: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute tool successfully', async () => {
      const context: ToolContext = {
        params: { input: 'hello' },
        workingDirectory: '/tmp',
      };

      const result = await tool.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'hello' });
    });

    it('should respect count parameter', async () => {
      const context: ToolContext = {
        params: { input: 'hi', count: 3 },
        workingDirectory: '/tmp',
      };

      const result = await tool.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'hihihi' });
    });
  });
});

describe('Tool Types', () => {
  it('should define Tool interface correctly', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'Test description',
      parameters: [],
      execute: async () => ({ success: true }),
      validateParameters: () => ({ valid: true, errors: [] }),
    };

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('Test description');
  });

  it('should define ToolResult interface correctly', () => {
    const successResult: ToolResult = {
      success: true,
      data: { key: 'value' },
      metadata: { executionTime: 100 },
    };

    expect(successResult.success).toBe(true);
    expect(successResult.data).toBeDefined();
  });

  it('should define ToolResult with error', () => {
    const errorResult: ToolResult = {
      success: false,
      error: 'Something went wrong',
    };

    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Something went wrong');
  });
});
