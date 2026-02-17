export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  AGENT_ERROR = 'AGENT_ERROR',
  WIKI_ERROR = 'WIKI_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
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
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
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

export type { Result as ResultType };
