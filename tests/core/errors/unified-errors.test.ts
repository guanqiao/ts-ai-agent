import {
  AppError,
  ErrorCode,
  Result,
  success,
  failure,
  isSuccess,
  isFailure,
  TSDGeneratorError,
  ErrorHandler,
  RetryConfig,
} from '@core/errors';

describe('Unified Error Handling', () => {
  describe('AppError (Unified)', () => {
    it('should create error with all TSDGeneratorError features', () => {
      const error = new AppError('Test error', ErrorCode.LLM_ERROR, {
        path: '/test/file.ts',
      });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.LLM_ERROR);
      expect(error.context).toEqual({ path: '/test/file.ts' });
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('AppError');
    });

    it('should support recoverable flag', () => {
      const error = new AppError('Rate limit', ErrorCode.LLM_RATE_LIMIT, {}, true);

      expect(error.recoverable).toBe(true);
    });

    it('should support retry count', () => {
      const error = new AppError('Timeout', ErrorCode.LLM_TIMEOUT, {}, true, 2, 3);

      expect(error.retryCount).toBe(2);
      expect(error.maxRetries).toBe(3);
    });

    it('should convert from native Error', () => {
      const nativeError = new Error('Native error');
      const appError = AppError.fromError(nativeError, ErrorCode.UNKNOWN_ERROR);

      expect(appError.message).toBe('Native error');
      expect(appError.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(appError.context?.originalError).toBe(nativeError);
    });
  });

  describe('ErrorCode (Unified)', () => {
    it('should include all error codes from both systems', () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBeDefined();
      expect(ErrorCode.LLM_ERROR).toBeDefined();
      expect(ErrorCode.LLM_RATE_LIMIT).toBeDefined();
      expect(ErrorCode.LLM_TIMEOUT).toBeDefined();
      expect(ErrorCode.FILE_NOT_FOUND).toBeDefined();
      expect(ErrorCode.PARSE_ERROR).toBeDefined();
      expect(ErrorCode.NETWORK_ERROR).toBeDefined();
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.CONFIG_INVALID).toBeDefined();
      expect(ErrorCode.WIKI_NOT_INITIALIZED).toBeDefined();
    });
  });

  describe('TSDGeneratorError (Backward Compatible)', () => {
    it('should be alias of AppError', () => {
      const error = new TSDGeneratorError(
        'Test error',
        ErrorCode.LLM_ERROR
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.LLM_ERROR);
    });
  });

  describe('ErrorHandler with Result', () => {
    let handler: ErrorHandler;

    beforeEach(() => {
      handler = new ErrorHandler();
    });

    it('should handle error and return TSDGeneratorError', () => {
      const nativeError = new Error('Test error');
      const handled = handler.handleError(nativeError);

      expect(handled).toBeInstanceOf(AppError);
      expect(handled.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should determine if error is retryable', () => {
      const rateLimitError = new AppError('Rate limit', ErrorCode.LLM_RATE_LIMIT, {}, true);
      const configError = new AppError('Invalid config', ErrorCode.CONFIG_INVALID);

      expect(handler.canRetry(rateLimitError)).toBe(true);
      expect(handler.canRetry(configError)).toBe(false);
    });

    it('should calculate retry delay with exponential backoff', () => {
      const delay0 = handler.getRetryDelay(0);
      const delay1 = handler.getRetryDelay(1);
      const delay2 = handler.getRetryDelay(2);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should execute with retry', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new AppError('Rate limit', ErrorCode.LLM_RATE_LIMIT, {}, true);
        }
        return 'success';
      };

      const result = await handler.withRetry(operation, { operationName: 'test' });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Result Pattern Integration', () => {
    it('should work with ErrorHandler', async () => {
      const handler = new ErrorHandler();
      
      const result = await Result.tryAsync(async () => {
        throw new Error('Test error');
      });

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error).toBeInstanceOf(AppError);
      }
    });
  });
});
