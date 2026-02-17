export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
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

export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

export interface Failure {
  readonly success: false;
  readonly error: AppError;
}

export type Result<T> = Success<T> | Failure;

export function success<T>(value: T): Success<T> {
  return { success: true, value };
}

export function failure<T = never>(error: AppError): Failure {
  return { success: false, error };
}

export function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.success === true;
}

export function isFailure<T>(result: Result<T>): result is Failure {
  return result.success === false;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly retryCount?: number;
  public readonly maxRetries?: number;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    context?: Record<string, unknown>,
    recoverable: boolean = false,
    retryCount?: number,
    maxRetries?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.retryCount = retryCount;
    this.maxRetries = maxRetries;
    this.timestamp = new Date();
  }

  static fromError(error: Error, code: ErrorCode = ErrorCode.UNKNOWN_ERROR): AppError {
    if (error instanceof AppError) {
      return error;
    }
    return new AppError(error.message, code, { originalError: error });
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
    };
  }
}

export type TSDGeneratorError = AppError;

export const TSDGeneratorError = AppError;

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
  retryableErrors: [ErrorCode.LLM_RATE_LIMIT, ErrorCode.LLM_TIMEOUT, ErrorCode.NETWORK_ERROR],
};

export class ErrorHandler {
  private retryConfig: RetryConfig;
  private errorLog: AppError[] = [];

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  handleError(error: Error | AppError): AppError {
    const appError =
      error instanceof AppError ? error : AppError.fromError(error, ErrorCode.UNKNOWN_ERROR);

    this.errorLog.push(appError);
    return appError;
  }

  canRetry(error: AppError): boolean {
    if (!error.recoverable) {
      return false;
    }

    if (error.retryCount !== undefined && error.maxRetries !== undefined) {
      return error.retryCount < error.maxRetries;
    }

    return this.retryConfig.retryableErrors.includes(error.code);
  }

  getRetryDelay(retryCount: number): number {
    const delay =
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; maxRetries?: number }
  ): Promise<T> {
    const maxRetries = context.maxRetries ?? this.retryConfig.maxRetries;
    let lastError: AppError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const appError = this.handleError(error as Error);
        lastError = appError;

        if (!this.canRetry(appError) || attempt === maxRetries) {
          throw appError;
        }

        const delay = this.getRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  getErrorLog(): AppError[] {
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
  canRecover: (error: AppError) => boolean;
  recover: (error: AppError) => Promise<void>;
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

  async attemptRecovery(error: AppError): Promise<boolean> {
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
): AppError {
  return new AppError(message, code, options.details, options.recoverable ?? false);
}

export function isRecoverable(error: Error): boolean {
  if (error instanceof AppError) {
    return error.recoverable;
  }
  return false;
}

export function getErrorCode(error: Error): ErrorCode {
  if (error instanceof AppError) {
    return error.code;
  }
  return ErrorCode.UNKNOWN_ERROR;
}

export const Result = {
  map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
    if (isSuccess(result)) {
      return success(fn(result.value));
    }
    return result;
  },

  flatMap<T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> {
    if (isSuccess(result)) {
      return fn(result.value);
    }
    return result;
  },

  mapError<T>(result: Result<T>, fn: (error: AppError) => AppError): Result<T> {
    if (isFailure(result)) {
      return failure(fn(result.error));
    }
    return result;
  },

  unwrap<T>(result: Result<T>): T {
    if (isSuccess(result)) {
      return result.value;
    }
    throw result.error;
  },

  unwrapOr<T>(result: Result<T>, defaultValue: T): T {
    if (isSuccess(result)) {
      return result.value;
    }
    return defaultValue;
  },

  fromPromise<T>(promise: Promise<T>): Promise<Result<T>> {
    return promise.then(success).catch((error) => failure(AppError.fromError(error)));
  },

  try<T>(fn: () => T): Result<T> {
    try {
      return success(fn());
    } catch (error) {
      return failure(AppError.fromError(error as Error));
    }
  },

  async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
    try {
      const value = await fn();
      return success(value);
    } catch (error) {
      return failure(AppError.fromError(error as Error));
    }
  },
};
