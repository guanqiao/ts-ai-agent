import { ToolDefinition } from './types';

export interface ToolSelection {
  tools: ToolDefinition[];
  reasoning: string;
}

export interface PlanStep {
  tool: string;
  parameters: Record<string, unknown>;
  parameterHints?: Record<string, string>;
  reason: string;
}

export interface ToolPlan {
  steps: PlanStep[];
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ExecutionContext {
  completedSteps: Array<{ tool: string; result: string }>;
  originalTask: string;
}

export class ToolPlanner {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async selectTools(task: string): Promise<ToolSelection> {
    const taskLower = task.toLowerCase();
    const selectedTools: ToolDefinition[] = [];
    const reasons: string[] = [];

    for (const [name, tool] of this.tools) {
      const keywords = this.extractKeywords(tool.description);
      const matches = keywords.some((kw) => taskLower.includes(kw));

      if (matches || this.toolMatchesTask(name, taskLower)) {
        selectedTools.push(tool);
        reasons.push(`Tool '${name}' matches task keywords`);
      }
    }

    if (selectedTools.length === 0) {
      return {
        tools: Array.from(this.tools.values()),
        reasoning: 'No specific tools matched, returning all available tools for user selection',
      };
    }

    return {
      tools: selectedTools,
      reasoning: reasons.join('; '),
    };
  }

  async createPlan(task: string): Promise<ToolPlan> {
    const taskLower = task.toLowerCase();
    const steps: PlanStep[] = [];

    if (taskLower.includes('read') || taskLower.includes('查看') || taskLower.includes('读取')) {
      const filePath = this.extractFilePath(task);
      steps.push({
        tool: 'read_file',
        parameters: filePath ? { path: filePath } : {},
        parameterHints: filePath ? undefined : { path: 'File path to read' },
        reason: 'Read file contents as requested',
      });
    }

    if (
      taskLower.includes('write') ||
      taskLower.includes('create') ||
      taskLower.includes('创建') ||
      taskLower.includes('写入')
    ) {
      const filePath = this.extractFilePath(task);
      steps.push({
        tool: 'write_file',
        parameters: filePath ? { path: filePath, content: '' } : {},
        parameterHints: { path: 'File path to write', content: 'Content to write' },
        reason: 'Write to file as requested',
      });
    }

    if (
      taskLower.includes('search') ||
      taskLower.includes('find') ||
      taskLower.includes('查找') ||
      taskLower.includes('搜索')
    ) {
      const query = this.extractSearchQuery(task);
      steps.push({
        tool: 'search_code',
        parameters: query ? { query } : {},
        parameterHints: query ? undefined : { query: 'Search query' },
        reason: 'Search codebase as requested',
      });
    }

    if (
      taskLower.includes('execute') ||
      taskLower.includes('run') ||
      taskLower.includes('执行') ||
      taskLower.includes('运行')
    ) {
      steps.push({
        tool: 'execute_command',
        parameters: {},
        parameterHints: { command: 'Command to execute' },
        reason: 'Execute command as requested',
      });
    }

    if (steps.length === 0) {
      const selection = await this.selectTools(task);
      if (selection.tools.length > 0) {
        steps.push({
          tool: selection.tools[0].name,
          parameters: {},
          parameterHints: this.getParameterHints(selection.tools[0]),
          reason: 'Suggested tool based on task analysis',
        });
      }
    }

    return { steps };
  }

  async suggestNextTool(context: ExecutionContext): Promise<PlanStep | null> {
    const taskLower = context.originalTask.toLowerCase();
    const completedToolNames = context.completedSteps.map((s) => s.tool);

    if (taskLower.includes('read') && !completedToolNames.includes('read_file')) {
      return {
        tool: 'read_file',
        parameters: {},
        parameterHints: { path: 'File path to read' },
        reason: 'Read file as next step',
      };
    }

    if (taskLower.includes('search') && !completedToolNames.includes('search_code')) {
      return {
        tool: 'search_code',
        parameters: {},
        parameterHints: { query: 'Search query' },
        reason: 'Search as next step',
      };
    }

    if (context.completedSteps.some((s) => s.tool === 'read_file') && taskLower.includes('write')) {
      return {
        tool: 'write_file',
        parameters: {},
        parameterHints: { path: 'File path', content: 'Content to write' },
        reason: 'Write file after reading',
      };
    }

    return null;
  }

  validatePlan(plan: ToolPlan): PlanValidationResult {
    const errors: string[] = [];

    for (const step of plan.steps) {
      const tool = this.tools.get(step.tool);
      if (!tool) {
        errors.push(`Unknown tool: ${step.tool}`);
        continue;
      }

      for (const param of tool.parameters) {
        if (param.required && !(param.name in step.parameters)) {
          errors.push(`Missing required parameter '${param.name}' for tool '${step.tool}'`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private extractKeywords(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    return words.filter((w) => w.length > 3);
  }

  private toolMatchesTask(toolName: string, taskLower: string): boolean {
    const toolKeywords: Record<string, string[]> = {
      read_file: ['read', 'file', 'content', '查看', '读取', '文件'],
      write_file: ['write', 'create', 'file', 'save', '写入', '创建', '保存'],
      search_code: ['search', 'find', 'look', '查找', '搜索', '寻找'],
      execute_command: ['execute', 'run', 'command', 'shell', '执行', '运行', '命令'],
    };

    const keywords = toolKeywords[toolName] || [];
    return keywords.some((kw) => taskLower.includes(kw));
  }

  private extractFilePath(task: string): string | null {
    const patterns = [/['"]([^'"]+\.[a-zA-Z]+)['"]/g, /\b([a-zA-Z0-9_\-/]+\.[a-zA-Z]{1,4})\b/g];

    for (const pattern of patterns) {
      const matches = task.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].replace(/['"]/g, '');
      }
    }

    return null;
  }

  private extractSearchQuery(task: string): string | null {
    const patterns = [
      /(?:search|find|查找|搜索)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i,
      /['"]([^'"]+)['"]/,
    ];

    for (const pattern of patterns) {
      const match = task.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private getParameterHints(tool: ToolDefinition): Record<string, string> {
    const hints: Record<string, string> = {};
    for (const param of tool.parameters) {
      hints[param.name] = param.description || param.name;
    }
    return hints;
  }
}
