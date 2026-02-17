import {
  Logger,
  LogLevel,
  createLogger,
  logger,
  setGlobalLogLevel,
} from '@utils/logger';

describe('Logger', () => {
  let mockOutput: { write: jest.Mock };
  let testLogger: InstanceType<typeof Logger>;

  beforeEach(() => {
    mockOutput = { write: jest.fn() };
    testLogger = createLogger({
      level: LogLevel.DEBUG,
      output: mockOutput as unknown as NodeJS.WritableStream,
      timestamp: false,
      colorize: false,
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      testLogger.debug('Debug message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
    });

    it('should log info messages', () => {
      testLogger.info('Info message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
    });

    it('should log warn messages', () => {
      testLogger.warn('Warn message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Warn message')
      );
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
    });

    it('should log error messages', () => {
      testLogger.error('Error message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
    });
  });

  describe('level filtering', () => {
    it('should filter messages below log level', () => {
      testLogger.setLevel(LogLevel.WARN);

      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warn message');

      expect(mockOutput.write).toHaveBeenCalledTimes(1);
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Warn message')
      );
    });

    it('should not log anything when SILENT', () => {
      testLogger.setLevel(LogLevel.SILENT);

      testLogger.error('Error message');

      expect(mockOutput.write).not.toHaveBeenCalled();
    });
  });

  describe('prefix', () => {
    it('should include prefix in log message', () => {
      const prefixedLogger = createLogger({
        prefix: 'MyModule',
        output: mockOutput as unknown as NodeJS.WritableStream,
        timestamp: false,
        colorize: false,
      });

      prefixedLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('[MyModule]')
      );
    });

    it('should set prefix dynamically', () => {
      testLogger.setPrefix('DynamicPrefix');
      testLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('[DynamicPrefix]')
      );
    });
  });

  describe('data logging', () => {
    it('should log additional data as JSON', () => {
      testLogger.info('Message with data', { key: 'value', count: 42 });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('"key":"value"')
      );
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('"count":42')
      );
    });
  });

  describe('error handling', () => {
    it('should log Error objects', () => {
      const error = new Error('Test error');
      testLogger.error('Something failed', error);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });

    it('should log error data objects', () => {
      testLogger.error('Failed', { code: 'ERR001', details: 'Something went wrong' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('ERR001')
      );
    });
  });

  describe('handlers', () => {
    it('should call custom handlers', () => {
      const handler = jest.fn();
      testLogger.addHandler(handler);

      testLogger.info('Test message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Test message',
        })
      );
    });

    it('should remove handlers', () => {
      const handler = jest.fn();
      testLogger.addHandler(handler);
      testLogger.removeHandler(handler);

      testLogger.info('Test message');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('child logger', () => {
    it('should create child logger with combined prefix', () => {
      testLogger.setPrefix('Parent');
      const child = testLogger.createChild('Child');

      child.info('Child message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.stringContaining('[Parent:Child]')
      );
    });

    it('should inherit handlers', () => {
      const handler = jest.fn();
      testLogger.addHandler(handler);
      const child = testLogger.createChild('Child');

      child.info('Child message');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('global logger', () => {
    it('should have default log level', () => {
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('should set global log level', () => {
      setGlobalLogLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);

      setGlobalLogLevel(LogLevel.INFO);
    });
  });
});
