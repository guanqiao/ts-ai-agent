import {
  TSDGeneratorError,
  AppError,
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
      const error = new TSDGeneratorError(
        'Test error',
        ErrorCode.LLM_ERROR,
        { key: 'value' },
        true
      );

      expect(error.code).toBe(ErrorCode.LLM_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.recoverable).toBe(true);
    });
  });

  describe('fromError', () => {
    it('should convert standard error to TSDGeneratorError', () => {
      const originalError = new Error('Original error');
      const tsdError = TSDGeneratorError.fromError(originalError, ErrorCode.PARSE_ERROR);

      expect(tsdError.code).toBe(ErrorCode.PARSE_ERROR);
      expect(tsdError.message).toBe('Original error');
      expect(tsdError.context?.originalError).toBe(originalError);
    });

    it('should return existing TSDGeneratorError unchanged', () => {
      const original = new TSDGeneratorError(
        'Test',
        ErrorCode.LLM_ERROR
      );

      const result = TSDGeneratorError.fromError(original, ErrorCode.UNKNOWN_ERROR);

      expect(result).toBe(original);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new TSDGeneratorError(
        'Config error',
        ErrorCode.CONFIG_INVALID,
        {},
        true
      );

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

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Test error');
    });

    it('should handle TSDGeneratorError', () => {
      const tsdError = new TSDGeneratorError(
        'LLM error',
        ErrorCode.LLM_ERROR
      );

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
      const error = new TSDGeneratorError(
        'Config error',
        ErrorCode.CONFIG_INVALID,
        {},
        false
      );

      expect(handler.canRetry(error)).toBe(false);
    });

    it('should return true for recoverable errors', () => {
      const error = new TSDGeneratorError(
        'Rate limit',
        ErrorCode.LLM_RATE_LIMIT,
        {},
        true
      );

      expect(handler.canRetry(error)).toBe(true);
    });

    it('should respect retry count', () => {
      const error = new TSDGeneratorError(
        'Timeout',
        ErrorCode.LLM_TIMEOUT,
        {},
        true,
        3,
        3
      );

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
        .mockRejectedValueOnce(new TSDGeneratorError(
          'Rate limit',
          ErrorCode.LLM_RATE_LIMIT,
          {},
          true
        ))
        .mockResolvedValue('success');

      const result = await handler.withRetry(operation, { operationName: 'test' });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error = new TSDGeneratorError(
        'Timeout',
        ErrorCode.LLM_TIMEOUT,
        {},
        true
      );

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

    expect(error.context).toEqual({ field: 'name' });
    expect(error.recoverable).toBe(true);
  });
});

describe('isRecoverable', () => {
  it('should return true for recoverable TSDGeneratorError', () => {
    const error = new TSDGeneratorError(
      'Test',
      ErrorCode.LLM_ERROR,
      {},
      true
    );

    expect(isRecoverable(error)).toBe(true);
  });

  it('should return false for standard Error', () => {
    const error = new Error('Test');

    expect(isRecoverable(error)).toBe(false);
  });
});

describe('getErrorCode', () => {
  it('should return code for TSDGeneratorError', () => {
    const error = new TSDGeneratorError(
      'Test',
      ErrorCode.CONFIG_INVALID
    );

    expect(getErrorCode(error)).toBe(ErrorCode.CONFIG_INVALID);
  });

  it('should return UNKNOWN_ERROR for standard Error', () => {
    const error = new Error('Test');

    expect(getErrorCode(error)).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});

describe('ErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
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
