export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolContext {
  params: Record<string, unknown>;
  workingDirectory: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    [key: string]: unknown;
  };
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameter[];
  execute(context: ToolContext): Promise<ToolResult>;
  validateParameters(params: Record<string, unknown>): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: string;
  name: string;
  result: ToolResult;
}

export interface ToolExecutorConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export const DEFAULT_TOOL_EXECUTOR_CONFIG: ToolExecutorConfig = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
};
