import {
  TSDGeneratorError,
  ErrorHandler,
  ErrorCode,
  DEFAULT_RETRY_CONFIG,
  createError,
  isRecoverable,
  getErrorCode,
} from '../../src/error/handler';

describe('TSDGeneratorError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.LLM_ERROR,
        message: 'Test error',
        details: { key: 'value' },
        timestamp: new Date(),
        recoverable: true,
      });

      expect(error.code).toBe(ErrorCode.LLM_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.recoverable).toBe(true);
    });
  });

  describe('fromError', () => {
    it('should convert standard error to TSDGeneratorError', () => {
      const originalError = new Error('Original error');
      const tsdError = TSDGeneratorError.fromError(originalError, ErrorCode.PARSE_ERROR);

      expect(tsdError.code).toBe(ErrorCode.PARSE_ERROR);
      expect(tsdError.message).toBe('Original error');
      expect(tsdError.cause).toBe(originalError);
    });

    it('should return existing TSDGeneratorError unchanged', () => {
      const original = new TSDGeneratorError({
        code: ErrorCode.LLM_ERROR,
        message: 'Test',
        timestamp: new Date(),
        recoverable: false,
      });

      const result = TSDGeneratorError.fromError(original, ErrorCode.UNKNOWN);

      expect(result).toBe(original);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'Config error',
        timestamp: new Date(),
        recoverable: true,
      });

      const json = error.toJSON() as Record<string, unknown>;

      expect(json.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(json.message).toBe('Config error');
      expect(json.recoverable).toBe(true);
    });
  });
});

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  describe('handleError', () => {
    it('should handle standard errors', () => {
      const error = new Error('Test error');
      const result = handler.handleError(error);

      expect(result).toBeInstanceOf(TSDGeneratorError);
      expect(result.message).toBe('Test error');
    });

    it('should handle TSDGeneratorError', () => {
      const tsdError = new TSDGeneratorError({
        code: ErrorCode.LLM_ERROR,
        message: 'LLM error',
        timestamp: new Date(),
        recoverable: false,
      });

      const result = handler.handleError(tsdError);

      expect(result).toBe(tsdError);
    });

    it('should log errors', () => {
      handler.handleError(new Error('Error 1'));
      handler.handleError(new Error('Error 2'));

      const log = handler.getErrorLog();
      expect(log.length).toBe(2);
    });
  });

  describe('canRetry', () => {
    it('should return false for non-recoverable errors', () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'Config error',
        timestamp: new Date(),
        recoverable: false,
      });

      expect(handler.canRetry(error)).toBe(false);
    });

    it('should return true for recoverable errors', () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.LLM_RATE_LIMIT,
        message: 'Rate limit',
        timestamp: new Date(),
        recoverable: true,
      });

      expect(handler.canRetry(error)).toBe(true);
    });

    it('should respect retry count', () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.LLM_TIMEOUT,
        message: 'Timeout',
        timestamp: new Date(),
        recoverable: true,
        retryCount: 3,
        maxRetries: 3,
      });

      expect(handler.canRetry(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay0 = handler.getRetryDelay(0);
      const delay1 = handler.getRetryDelay(1);
      const delay2 = handler.getRetryDelay(2);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should respect max delay', () => {
      const largeDelay = handler.getRetryDelay(100);
      expect(largeDelay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await handler.withRetry(operation, { operationName: 'test' });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on recoverable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new TSDGeneratorError({
          code: ErrorCode.LLM_RATE_LIMIT,
          message: 'Rate limit',
          timestamp: new Date(),
          recoverable: true,
        }))
        .mockResolvedValue('success');

      const result = await handler.withRetry(operation, { operationName: 'test' });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error = new TSDGeneratorError({
        code: ErrorCode.LLM_TIMEOUT,
        message: 'Timeout',
        timestamp: new Date(),
        recoverable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        handler.withRetry(operation, { operationName: 'test', maxRetries: 2 })
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('clearErrorLog', () => {
    it('should clear error log', () => {
      handler.handleError(new Error('Error'));
      handler.clearErrorLog();

      expect(handler.getErrorLog().length).toBe(0);
    });
  });
});

describe('createError', () => {
  it('should create error with code and message', () => {
    const error = createError(ErrorCode.FILE_NOT_FOUND, 'File not found');

    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.message).toBe('File not found');
  });

  it('should accept additional options', () => {
    const error = createError(ErrorCode.VALIDATION_ERROR, 'Validation failed', {
      details: { field: 'name' },
      recoverable: true,
    });

    expect(error.details).toEqual({ field: 'name' });
    expect(error.recoverable).toBe(true);
  });
});

describe('isRecoverable', () => {
  it('should return true for recoverable TSDGeneratorError', () => {
    const error = new TSDGeneratorError({
      code: ErrorCode.LLM_ERROR,
      message: 'Test',
      timestamp: new Date(),
      recoverable: true,
    });

    expect(isRecoverable(error)).toBe(true);
  });

  it('should return false for standard Error', () => {
    const error = new Error('Test');

    expect(isRecoverable(error)).toBe(false);
  });
});

describe('getErrorCode', () => {
  it('should return code for TSDGeneratorError', () => {
    const error = new TSDGeneratorError({
      code: ErrorCode.CONFIG_INVALID,
      message: 'Test',
      timestamp: new Date(),
      recoverable: false,
    });

    expect(getErrorCode(error)).toBe(ErrorCode.CONFIG_INVALID);
  });

  it('should return UNKNOWN for standard Error', () => {
    const error = new Error('Test');

    expect(getErrorCode(error)).toBe(ErrorCode.UNKNOWN);
  });
});

describe('ErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.UNKNOWN).toBe('UNKNOWN');
    expect(ErrorCode.CONFIG_INVALID).toBe('CONFIG_INVALID');
    expect(ErrorCode.LLM_ERROR).toBe('LLM_ERROR');
    expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
  });
});

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
  });
});
