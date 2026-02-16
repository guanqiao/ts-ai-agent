import { ToolRegistry } from './tool-registry';
import {
  ToolResult,
  ToolContext,
  ToolCallRequest,
  ToolCallResponse,
  ToolExecutorConfig,
  DEFAULT_TOOL_EXECUTOR_CONFIG,
} from './types';

export class ToolExecutor {
  private registry: ToolRegistry;
  private config: ToolExecutorConfig;

  constructor(registry: ToolRegistry, config?: Partial<ToolExecutorConfig>) {
    this.registry = registry;
    this.config = { ...DEFAULT_TOOL_EXECUTOR_CONFIG, ...config };
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    workingDirectory?: string
  ): Promise<ToolResult> {
    const tool = this.registry.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    const validation = tool.validateParameters(params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
      };
    }

    let lastError: string | undefined;
    let attempts = 0;

    while (attempts <= this.config.maxRetries) {
      attempts++;
      try {
        const context: ToolContext = {
          params,
          workingDirectory: workingDirectory || process.cwd(),
        };

        const startTime = Date.now();
        const result = await tool.execute(context);
        const executionTime = Date.now() - startTime;

        return {
          ...result,
          metadata: {
            ...result.metadata,
            executionTime,
            attempts,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempts <= this.config.maxRetries) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    return {
      success: false,
      error: lastError || 'Unknown error',
      metadata: { attempts },
    };
  }

  async executeWithTimeout(
    name: string,
    params: Record<string, unknown>,
    timeout: number,
    workingDirectory?: string
  ): Promise<ToolResult> {
    return Promise.race([
      this.execute(name, params, workingDirectory),
      this.createTimeoutPromise(timeout),
    ]);
  }

  async executeBatch(requests: ToolCallRequest[]): Promise<ToolCallResponse[]> {
    const promises = requests.map(async (request) => {
      const result = await this.execute(request.name, request.arguments);
      return {
        id: request.id,
        name: request.name,
        result,
      };
    });

    return Promise.all(promises);
  }

  private createTimeoutPromise(timeout: number): Promise<ToolResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: `Tool execution timeout after ${timeout}ms`,
        });
      }, timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
