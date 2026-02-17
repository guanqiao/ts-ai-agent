import {
  Result,
  success,
  failure,
  isSuccess,
  isFailure,
  AppError,
  ErrorCode,
} from '@core/types';

describe('Core Types', () => {
  describe('Result Pattern', () => {
    describe('success', () => {
      it('should create a successful result', () => {
        const result = success({ value: 42 });

        expect(isSuccess(result)).toBe(true);
        expect(isFailure(result)).toBe(false);
        if (isSuccess(result)) {
          expect(result.value).toEqual({ value: 42 });
        }
      });
    });

    describe('failure', () => {
      it('should create a failed result', () => {
        const error = new AppError('Something went wrong', ErrorCode.UNKNOWN_ERROR);
        const result = failure(error);

        expect(isSuccess(result)).toBe(false);
        expect(isFailure(result)).toBe(true);
        if (isFailure(result)) {
          expect(result.error.message).toBe('Something went wrong');
          expect(result.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
        }
      });
    });

    describe('map', () => {
      it('should map successful result', () => {
        const result = success(10);
        const mapped = Result.map(result, (x) => x * 2);

        expect(isSuccess(mapped)).toBe(true);
        if (isSuccess(mapped)) {
          expect(mapped.value).toBe(20);
        }
      });

      it('should not map failed result', () => {
        const error = new AppError('Error', ErrorCode.UNKNOWN_ERROR);
        const result = failure(error);
        const mapped = Result.map(result, (x) => (x as number) * 2);

        expect(isFailure(mapped)).toBe(true);
      });
    });

    describe('flatMap', () => {
      it('should flatMap successful result', () => {
        const result = success(10);
        const mapped = Result.flatMap(result, (x) => success(x * 2));

        expect(isSuccess(mapped)).toBe(true);
        if (isSuccess(mapped)) {
          expect(mapped.value).toBe(20);
        }
      });

      it('should propagate failure', () => {
        const error = new AppError('Error', ErrorCode.UNKNOWN_ERROR);
        const result = failure<number>(error);
        const mapped = Result.flatMap(result, (x: number) => success(x * 2));

        expect(isFailure(mapped)).toBe(true);
      });
    });
  });

  describe('AppError', () => {
    it('should create error with code and message', () => {
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('AppError');
    });

    it('should include context', () => {
      const error = new AppError('Test error', ErrorCode.FILE_NOT_FOUND, {
        path: '/test/file.txt',
      });

      expect(error.context).toEqual({ path: '/test/file.txt' });
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test error', ErrorCode.UNKNOWN_ERROR);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ErrorCode', () => {
    it('should have standard error codes', () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBeDefined();
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.FILE_NOT_FOUND).toBeDefined();
      expect(ErrorCode.PARSE_ERROR).toBeDefined();
      expect(ErrorCode.NETWORK_ERROR).toBeDefined();
      expect(ErrorCode.LLM_ERROR).toBeDefined();
      expect(ErrorCode.AGENT_ERROR).toBeDefined();
    });
  });
});
