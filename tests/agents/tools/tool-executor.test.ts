import { ToolExecutor } from '../../../src/agents/tools/tool-executor';
import { ToolRegistry } from '../../../src/agents/tools/tool-registry';
import { BaseTool } from '../../../src/agents/tools/base-tool';
import { ToolContext, ToolParameter, ToolResult } from '../../../src/agents/tools/types';

class EchoTool extends BaseTool {
  readonly name = 'echo';
  readonly description = 'Echo back the input message';
  readonly parameters: ToolParameter[] = [
    {
      name: 'message',
      type: 'string',
      description: 'Message to echo',
      required: true,
    },
  ];

  async execute(context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      data: { echoed: context.params.message },
    };
  }
}

class SlowTool extends BaseTool {
  readonly name = 'slow_tool';
  readonly description = 'A slow tool for timeout testing';
  readonly parameters: ToolParameter[] = [];

  async execute(_context: ToolContext): Promise<ToolResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      success: true,
      data: { completed: true },
    };
  }
}

class FailingTool extends BaseTool {
  readonly name = 'failing_tool';
  readonly description = 'A tool that fails';
  readonly parameters: ToolParameter[] = [];

  async execute(_context: ToolContext): Promise<ToolResult> {
    throw new Error('Tool execution failed');
  }
}

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(new EchoTool());
    registry.register(new SlowTool());
    registry.register(new FailingTool());
    executor = new ToolExecutor(registry);
  });

  describe('execute', () => {
    it('should execute a tool successfully', async () => {
      const result = await executor.execute('echo', { message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ echoed: 'hello' });
    });

    it('should return error for non-existent tool', async () => {
      const result = await executor.execute('non_existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should validate parameters before execution', async () => {
      const result = await executor.execute('echo', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    it('should handle tool execution errors', async () => {
      const result = await executor.execute('failing_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should include execution metadata', async () => {
      const result = await executor.execute('echo', { message: 'test' });

      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeWithTimeout', () => {
    it('should complete within timeout', async () => {
      const result = await executor.executeWithTimeout(
        'echo',
        { message: 'test' },
        1000
      );

      expect(result.success).toBe(true);
    });

    it('should timeout for slow tools', async () => {
      const result = await executor.executeWithTimeout(
        'slow_tool',
        {},
        50
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple tools in parallel', async () => {
      const requests = [
        { id: '1', name: 'echo', arguments: { message: 'first' } },
        { id: '2', name: 'echo', arguments: { message: 'second' } },
      ];

      const results = await executor.executeBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].result.success).toBe(true);
      expect(results[1].result.success).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const requests = [
        { id: '1', name: 'echo', arguments: { message: 'test' } },
        { id: '2', name: 'non_existent', arguments: {} },
      ];

      const results = await executor.executeBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].result.success).toBe(true);
      expect(results[1].result.success).toBe(false);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const flakyTool = new (class extends BaseTool {
        readonly name = 'flaky_tool';
        readonly description = 'A flaky tool';
        readonly parameters: ToolParameter[] = [];

        async execute(_context: ToolContext): Promise<ToolResult> {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true, data: { attempts } };
        }
      })();

      registry.register(flakyTool);
      const retryExecutor = new ToolExecutor(registry, { maxRetries: 3, retryDelay: 10 });

      const result = await retryExecutor.execute('flaky_tool', {});

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const alwaysFailTool = new (class extends BaseTool {
        readonly name = 'always_fail';
        readonly description = 'Always fails';
        readonly parameters: ToolParameter[] = [];

        async execute(_context: ToolContext): Promise<ToolResult> {
          throw new Error('Always fails');
        }
      })();

      registry.register(alwaysFailTool);
      const retryExecutor = new ToolExecutor(registry, { maxRetries: 2, retryDelay: 10 });

      const result = await retryExecutor.execute('always_fail', {});

      expect(result.success).toBe(false);
    });
  });
});

describe('ToolCallingAgent', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(new EchoTool());
    executor = new ToolExecutor(registry);
  });

  describe('planToolCalls', () => {
    it('should plan tool calls from task description', async () => {
      const agent = new ToolCallingAgent(executor, {
        systemPrompt: 'You are a helpful assistant.',
      });

      const plan = await agent.planToolCalls('Echo the message "hello world"');

      expect(plan).toBeDefined();
      expect(plan.toolCalls).toBeDefined();
      expect(Array.isArray(plan.toolCalls)).toBe(true);
    });
  });

  describe('executePlan', () => {
    it('should execute planned tool calls', async () => {
      const agent = new ToolCallingAgent(executor);

      const plan = {
        toolCalls: [
          { id: 'call_1', name: 'echo', arguments: { message: 'test' } },
        ],
      };

      const results = await agent.executePlan(plan);

      expect(results).toHaveLength(1);
      expect(results[0].result.success).toBe(true);
    });
  });

  describe('run', () => {
    it('should run full agent cycle', async () => {
      const agent = new ToolCallingAgent(executor);

      const result = await agent.run('Echo "hello"');

      expect(result.success).toBe(true);
      expect(result.toolResults).toBeDefined();
    });
  });
});

import { ToolCallingAgent } from '../../../src/agents/tools/tool-calling-agent';
