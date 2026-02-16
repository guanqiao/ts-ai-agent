import { ToolExecutor } from './tool-executor';
import { ToolCallRequest, ToolCallResponse } from './types';

export interface ToolCallingAgentConfig {
  systemPrompt?: string;
  maxIterations?: number;
  verbose?: boolean;
}

export interface ToolCallPlan {
  toolCalls: ToolCallRequest[];
  reasoning?: string;
}

export interface AgentRunResult {
  success: boolean;
  toolResults: ToolCallResponse[];
  finalOutput?: string;
  error?: string;
}

export class ToolCallingAgent {
  private executor: ToolExecutor;
  private _config: ToolCallingAgentConfig;

  constructor(executor: ToolExecutor, config?: ToolCallingAgentConfig) {
    this.executor = executor;
    this._config = {
      maxIterations: 10,
      verbose: false,
      ...config,
    };
  }

  get config(): ToolCallingAgentConfig {
    return this._config;
  }

  async planToolCalls(taskDescription: string): Promise<ToolCallPlan> {
    const toolCalls: ToolCallRequest[] = [];
    const lowerTask = taskDescription.toLowerCase();

    if (lowerTask.includes('echo')) {
      const messageMatch = taskDescription.match(/echo\s+(?:the\s+message\s+)?["']?([^"']+)["']?/i);
      const message = messageMatch ? messageMatch[1].trim() : taskDescription;

      toolCalls.push({
        id: `call_${Date.now()}`,
        name: 'echo',
        arguments: { message },
      });
    }

    return {
      toolCalls,
      reasoning: `Planning tool calls for task: ${taskDescription}`,
    };
  }

  async executePlan(plan: ToolCallPlan): Promise<ToolCallResponse[]> {
    return this.executor.executeBatch(plan.toolCalls);
  }

  async run(task: string): Promise<AgentRunResult> {
    try {
      const plan = await this.planToolCalls(task);

      if (plan.toolCalls.length === 0) {
        return {
          success: false,
          toolResults: [],
          error: 'No tool calls planned for the given task',
        };
      }

      const results = await this.executePlan(plan);

      const allSuccess = results.every((r) => r.result.success);

      return {
        success: allSuccess,
        toolResults: results,
        finalOutput: this.summarizeResults(results),
      };
    } catch (error) {
      return {
        success: false,
        toolResults: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private summarizeResults(results: ToolCallResponse[]): string {
    const successCount = results.filter((r) => r.result.success).length;
    return `Executed ${results.length} tool calls, ${successCount} succeeded`;
  }
}
