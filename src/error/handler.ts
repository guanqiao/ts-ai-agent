export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  WIKI_NOT_INITIALIZED = 'WIKI_NOT_INITIALIZED',
  WIKI_PAGE_NOT_FOUND = 'WIKI_PAGE_NOT_FOUND',
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface ErrorContext {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
  timestamp: Date;
  recoverable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export class TSDGeneratorError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly retryCount?: number;
  public readonly maxRetries?: number;

  constructor(context: ErrorContext) {
    super(context.message);
    this.name = 'TSDGeneratorError';
    this.code = context.code;
    this.details = context.details;
    this.cause = context.cause;
    this.timestamp = context.timestamp;
    this.recoverable = context.recoverable;
    this.retryCount = context.retryCount;
    this.maxRetries = context.maxRetries;

    if (context.cause) {
      this.stack = `${this.stack}\nCaused by: ${context.cause.stack}`;
    }
  }

  static fromError(error: Error, code: ErrorCode = ErrorCode.UNKNOWN): TSDGeneratorError {
    if (error instanceof TSDGeneratorError) {
      return error;
    }

    return new TSDGeneratorError({
      code,
      message: error.message,
      cause: error,
      timestamp: new Date(),
      recoverable: false,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      cause: this.cause?.message,
    };
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCode.LLM_RATE_LIMIT,
    ErrorCode.LLM_TIMEOUT,
    ErrorCode.NETWORK_ERROR,
  ],
};

export class ErrorHandler {
  private retryConfig: RetryConfig;
  private errorLog: TSDGeneratorError[] = [];

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  handleError(error: Error | TSDGeneratorError): TSDGeneratorError {
    const tsdError = error instanceof TSDGeneratorError
      ? error
      : TSDGeneratorError.fromError(error);

    this.errorLog.push(tsdError);
    return tsdError;
  }

  canRetry(error: TSDGeneratorError): boolean {
    if (!error.recoverable) {
      return false;
    }

    if (error.retryCount !== undefined && error.maxRetries !== undefined) {
      return error.retryCount < error.maxRetries;
    }

    return this.retryConfig.retryableErrors.includes(error.code);
  }

  getRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.baseDelayMs * 
      Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; maxRetries?: number }
  ): Promise<T> {
    const maxRetries = context.maxRetries ?? this.retryConfig.maxRetries;
    let lastError: TSDGeneratorError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const tsdError = this.handleError(error as Error);
        lastError = tsdError;

        if (!this.canRetry(tsdError) || attempt === maxRetries) {
          throw tsdError;
        }

        const delay = this.getRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  getErrorLog(): TSDGeneratorError[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export interface RecoveryStrategy {
  name: string;
  canRecover: (error: TSDGeneratorError) => boolean;
  recover: (error: TSDGeneratorError) => Promise<void>;
}

export class RecoveryManager {
  private strategies: Map<ErrorCode, RecoveryStrategy[]> = new Map();

  registerStrategy(strategy: RecoveryStrategy, codes: ErrorCode[]): void {
    for (const code of codes) {
      const existing = this.strategies.get(code) || [];
      existing.push(strategy);
      this.strategies.set(code, existing);
    }
  }

  async attemptRecovery(error: TSDGeneratorError): Promise<boolean> {
    const strategies = this.strategies.get(error.code) || [];

    for (const strategy of strategies) {
      if (strategy.canRecover(error)) {
        try {
          await strategy.recover(error);
          return true;
        } catch (recoveryError) {
          console.warn(`Recovery strategy "${strategy.name}" failed:`, recoveryError);
        }
      }
    }

    return false;
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  options: Partial<ErrorContext> = {}
): TSDGeneratorError {
  return new TSDGeneratorError({
    code,
    message,
    timestamp: new Date(),
    recoverable: false,
    ...options,
  });
}

export function isRecoverable(error: Error): boolean {
  if (error instanceof TSDGeneratorError) {
    return error.recoverable;
  }
  return false;
}

export function getErrorCode(error: Error): ErrorCode {
  if (error instanceof TSDGeneratorError) {
    return error.code;
  }
  return ErrorCode.UNKNOWN;
}
