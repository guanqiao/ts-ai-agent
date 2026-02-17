export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colorize?: boolean;
  output?: NodeJS.WritableStream;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  prefix?: string;
  data?: Record<string, unknown>;
}

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.cyan,
  [LogLevel.INFO]: COLORS.blue,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.SILENT]: COLORS.reset,
};

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
};

class LoggerImpl {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private colorize: boolean;
  private output: NodeJS.WritableStream;
  private handlers: ((entry: LogEntry) => void)[] = [];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.timestamp = options.timestamp ?? true;
    this.colorize = options.colorize ?? true;
    this.output = options.output ?? process.stdout;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: (entry: LogEntry) => void): void {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    const data = error instanceof Error
      ? { error: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      prefix: this.prefix,
      data,
    };

    for (const handler of this.handlers) {
      handler(entry);
    }

    const formatted = this.format(entry);
    this.output.write(formatted + '\n');
  }

  private format(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.timestamp) {
      const time = entry.timestamp.toISOString();
      parts.push(this.colorize ? `${COLORS.dim}${time}${COLORS.reset}` : time);
    }

    const levelName = LEVEL_NAMES[entry.level];
    if (this.colorize) {
      parts.push(`${LEVEL_COLORS[entry.level]}${levelName.padEnd(5)}${COLORS.reset}`);
    } else {
      parts.push(levelName.padEnd(5));
    }

    if (entry.prefix) {
      parts.push(this.colorize ? `${COLORS.cyan}[${entry.prefix}]${COLORS.reset}` : `[${entry.prefix}]`);
    }

    parts.push(entry.message);

    if (entry.data && Object.keys(entry.data).length > 0) {
      parts.push(JSON.stringify(entry.data));
    }

    return parts.join(' ');
  }

  createChild(prefix: string, options?: Partial<LoggerOptions>): LoggerImpl {
    const child = new LoggerImpl({
      level: options?.level ?? this.level,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      timestamp: options?.timestamp ?? this.timestamp,
      colorize: options?.colorize ?? this.colorize,
      output: options?.output ?? this.output,
    });

    for (const handler of this.handlers) {
      child.addHandler(handler);
    }

    return child;
  }
}

export const Logger = LoggerImpl;

export const logger = new Logger();

export function createLogger(options?: LoggerOptions): LoggerImpl {
  return new Logger(options);
}

export function setGlobalLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

export function debug(message: string, data?: Record<string, unknown>): void {
  logger.debug(message, data);
}

export function info(message: string, data?: Record<string, unknown>): void {
  logger.info(message, data);
}

export function warn(message: string, data?: Record<string, unknown>): void {
  logger.warn(message, data);
}

export function error(message: string, err?: Error | Record<string, unknown>): void {
  logger.error(message, err);
}
