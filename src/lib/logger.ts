/**
 * Unified logging utility for the application
 *
 * - Production: Only outputs warn and error levels
 * - Development: Outputs all levels
 * - Supports structured data for log analysis
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  [key: string]: unknown;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
} as const;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLogLevel(): LogLevel {
  const configuredLevel = process.env.LOG_LEVEL?.toLowerCase();

  if (configuredLevel && Object.hasOwn(LOG_LEVEL_PRIORITY, configuredLevel)) {
    return configuredLevel as LogLevel;
  }

  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
}

const MIN_LOG_LEVEL = resolveMinLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatMessage(
  level: LogLevel,
  prefix: string,
  message: string
): string {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const reset = LOG_COLORS.reset;
  const levelLabel = level.toUpperCase().padEnd(5);

  // In browser, colors don't work the same way
  if (typeof window !== 'undefined') {
    return `[${timestamp}] ${levelLabel} [${prefix}] ${message}`;
  }

  return `${color}[${timestamp}] ${levelLabel}${reset} [${prefix}] ${message}`;
}

function formatData(data: LogData): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return '[Unable to serialize data]';
  }
}

function writeServerLog(
  message: string,
  stream: 'stdout' | 'stderr' = 'stdout'
): void {
  const target = stream === 'stderr' ? process.stderr : process.stdout;
  target.write(`${message}\n`);
}

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  debug(message: string, data?: LogData): void {
    if (!shouldLog('debug')) return;
    const formattedMessage = formatMessage('debug', this.prefix, message);
    if (typeof window !== 'undefined') {
      console.log(formattedMessage);
      if (data) console.log(formatData(data));
      return;
    }

    writeServerLog(formattedMessage);
    if (data) writeServerLog(formatData(data));
  }

  info(message: string, data?: LogData): void {
    if (!shouldLog('info')) return;
    const formattedMessage = formatMessage('info', this.prefix, message);
    if (typeof window !== 'undefined') {
      console.log(formattedMessage);
      if (data) console.log(formatData(data));
      return;
    }

    writeServerLog(formattedMessage);
    if (data) writeServerLog(formatData(data));
  }

  warn(message: string, data?: LogData): void {
    if (!shouldLog('warn')) return;
    const formattedMessage = formatMessage('warn', this.prefix, message);
    if (typeof window !== 'undefined') {
      console.warn(formattedMessage);
      if (data) console.warn(formatData(data));
      return;
    }

    writeServerLog(formattedMessage, 'stderr');
    if (data) writeServerLog(formatData(data), 'stderr');
  }

  error(message: string, error?: unknown, data?: LogData): void {
    if (!shouldLog('error')) return;
    const formattedMessage = formatMessage('error', this.prefix, message);

    if (typeof window !== 'undefined') {
      console.error(formattedMessage);
      if (error) {
        if (error instanceof Error) {
          console.error(`  Error: ${error.message}`);
          if (error.stack) {
            console.error(`  Stack: ${error.stack}`);
          }
        } else {
          console.error(`  Error: ${String(error)}`);
        }
      }
      if (data) console.error(formatData(data));
      return;
    }

    writeServerLog(formattedMessage, 'stderr');
    if (error) {
      if (error instanceof Error) {
        writeServerLog(`  Error: ${error.message}`, 'stderr');
        if (error.stack) {
          writeServerLog(`  Stack: ${error.stack}`, 'stderr');
        }
      } else {
        writeServerLog(`  Error: ${String(error)}`, 'stderr');
      }
    }
    if (data) writeServerLog(formatData(data), 'stderr');
  }
}

// Pre-configured loggers for different modules
export const logger = {
  payment: new Logger('Payment'),
  credits: new Logger('Credits'),
  auth: new Logger('Auth'),
  mail: new Logger('Mail'),
  newsletter: new Logger('Newsletter'),
  storage: new Logger('Storage'),
  ai: new Logger('AI'),
  api: new Logger('API'),
  actions: new Logger('Actions'),
  general: new Logger('App'),
};

// Factory function for custom loggers
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

export type { Logger, LogData };
