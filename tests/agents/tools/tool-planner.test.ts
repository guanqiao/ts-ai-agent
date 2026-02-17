import { ToolPlanner, ToolPlan, ToolSelection } from '@agents/tools/planner';
import { ToolDefinition, ToolParameter } from '@agents/tools/types';

describe('ToolPlanner', () => {
  let planner: ToolPlanner;
  let mockTools: ToolDefinition[];

  beforeEach(() => {
    mockTools = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: [
          { name: 'path', type: 'string', description: 'File path to read', required: true },
        ],
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: [
          { name: 'path', type: 'string', description: 'File path to write', required: true },
          { name: 'content', type: 'string', description: 'Content to write', required: true },
        ],
      },
      {
        name: 'search_code',
        description: 'Search for code patterns in the codebase',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
        ],
      },
      {
        name: 'execute_command',
        description: 'Execute a shell command',
        parameters: [
          { name: 'command', type: 'string', description: 'Command to execute', required: true },
        ],
      },
    ];

    planner = new ToolPlanner(mockTools);
  });

  describe('getAvailableTools', () => {
    it('should return all available tools', () => {
      const tools = planner.getAvailableTools();

      expect(tools).toHaveLength(4);
      expect(tools.map((t) => t.name)).toContain('read_file');
      expect(tools.map((t) => t.name)).toContain('write_file');
    });
  });

  describe('selectTools', () => {
    it('should select relevant tools for file reading task', async () => {
      const task = 'Read the contents of package.json';

      const selection = await planner.selectTools(task);

      expect(selection.tools.length).toBeGreaterThan(0);
      expect(selection.tools.some((t) => t.name === 'read_file')).toBe(true);
    });

    it('should select relevant tools for file writing task', async () => {
      const task = 'Create a new file called test.txt with content "Hello"';

      const selection = await planner.selectTools(task);

      expect(selection.tools.some((t) => t.name === 'write_file')).toBe(true);
    });

    it('should select relevant tools for search task', async () => {
      const task = 'Find all functions that handle authentication';

      const selection = await planner.selectTools(task);

      expect(selection.tools.some((t) => t.name === 'search_code')).toBe(true);
    });

    it('should return reasoning for tool selection', async () => {
      const task = 'Read package.json and search for dependencies';

      const selection = await planner.selectTools(task);

      expect(selection.reasoning).toBeDefined();
      expect(typeof selection.reasoning).toBe('string');
    });
  });

  describe('createPlan', () => {
    it('should create a plan with ordered steps', async () => {
      const task = 'Read package.json, find dependencies, and write them to a new file';

      const plan = await planner.createPlan(task);

      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps[0].tool).toBeDefined();
      expect(plan.steps[0].reason).toBeDefined();
    });

    it('should create steps with correct parameter hints', async () => {
      const task = 'Read the file';

      const plan = await planner.createPlan(task);

      const readStep = plan.steps.find((s) => s.tool === 'read_file');
      expect(readStep).toBeDefined();
      expect(readStep?.parameterHints?.path).toBeDefined();
    });

    it('should handle complex multi-step tasks', async () => {
      const task = 'Search for all test files, read each one, and create a summary';

      const plan = await planner.createPlan(task);

      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('suggestNextTool', () => {
    it('should suggest next tool based on context', async () => {
      const context = {
        completedSteps: [
          { tool: 'search_code', result: 'Found 5 files' },
        ],
        originalTask: 'Find and read all test files',
      };

      const suggestion = await planner.suggestNextTool(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.tool).toBeDefined();
    });
  });

  describe('validatePlan', () => {
    it('should validate a correct plan', () => {
      const plan: ToolPlan = {
        steps: [
          {
            tool: 'read_file',
            parameters: { path: 'test.txt' },
            reason: 'Read the file',
          },
        ],
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required parameters', () => {
      const plan: ToolPlan = {
        steps: [
          {
            tool: 'write_file',
            parameters: { path: 'test.txt' },
            reason: 'Write to file',
          },
        ],
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('content'))).toBe(true);
    });

    it('should detect unknown tools', () => {
      const plan: ToolPlan = {
        steps: [
          {
            tool: 'unknown_tool',
            parameters: {},
            reason: 'Unknown tool',
          },
        ],
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown tool'))).toBe(true);
    });
  });
});
