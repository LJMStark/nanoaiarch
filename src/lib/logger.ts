/**
 * Unified logging utility for the application.
 *
 * Production server: emits one JSON object per line (Week 5.3) so log
 * aggregators (Vercel logs, Datadog, Axiom, Loki, etc.) can index
 * fields directly without regex parsing. Each line has a stable shape:
 *   { ts, level, prefix, msg, data?, err? }
 *
 * Development server: emits colorized human-friendly multi-line output.
 * Browser: emits the same human-friendly form via console.* (so the
 * devtools timeline groups it normally; JSON in browser console is
 * needlessly verbose).
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

/**
 * JSON output is enabled when running on the server in production.
 * Development server keeps the colorized format because humans read it
 * during local debugging. Browser also keeps human format.
 *
 * Override either way with LOG_FORMAT=json or LOG_FORMAT=human (useful
 * for piping local server logs through jq, or running prod with human
 * format for incident debugging).
 */
function resolveJsonOutput(): boolean {
  const configured = process.env.LOG_FORMAT?.toLowerCase();
  if (configured === 'json') return true;
  if (configured === 'human') return false;
  if (typeof window !== 'undefined') return false;
  return process.env.NODE_ENV === 'production';
}

const USE_JSON_OUTPUT = resolveJsonOutput();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatHumanMessage(
  level: LogLevel,
  prefix: string,
  message: string
): string {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const reset = LOG_COLORS.reset;
  const levelLabel = level.toUpperCase().padEnd(5);

  // In browser, ANSI colors render as junk text — drop them.
  if (typeof window !== 'undefined') {
    return `[${timestamp}] ${levelLabel} [${prefix}] ${message}`;
  }

  return `${color}[${timestamp}] ${levelLabel}${reset} [${prefix}] ${message}`;
}

function formatHumanData(data: LogData): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return '[Unable to serialize data]';
  }
}

interface SerializedError {
  message: string;
  stack?: string;
  name?: string;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return { message: String(error) };
}

interface JsonLogLine {
  ts: string;
  level: LogLevel;
  prefix: string;
  msg: string;
  data?: LogData;
  err?: SerializedError;
}

function formatJsonLine(
  level: LogLevel,
  prefix: string,
  message: string,
  data?: LogData,
  error?: unknown
): string {
  const line: JsonLogLine = {
    ts: new Date().toISOString(),
    level,
    prefix,
    msg: message,
  };
  if (data) line.data = data;
  if (error !== undefined) line.err = serializeError(error);
  try {
    return JSON.stringify(line);
  } catch {
    // Last-ditch fallback when data contains a circular ref. Drop the
    // payload but keep the message + level so we don't lose the event.
    return JSON.stringify({
      ts: line.ts,
      level: line.level,
      prefix: line.prefix,
      msg: line.msg,
      err: { message: 'log serialization failed' },
    });
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

  private emit(
    level: LogLevel,
    message: string,
    data?: LogData,
    error?: unknown
  ): void {
    if (!shouldLog(level)) return;

    const stream: 'stdout' | 'stderr' =
      level === 'warn' || level === 'error' ? 'stderr' : 'stdout';

    if (USE_JSON_OUTPUT) {
      writeServerLog(
        formatJsonLine(level, this.prefix, message, data, error),
        stream
      );
      return;
    }

    // Human format — split message + (optional) error/data across lines so
    // the colorized header stays compact and the payload is pretty-printed.
    const formattedMessage = formatHumanMessage(level, this.prefix, message);

    if (typeof window !== 'undefined') {
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      consoleFn(formattedMessage);
      if (error) {
        if (error instanceof Error) {
          consoleFn(`  Error: ${error.message}`);
          if (error.stack) consoleFn(`  Stack: ${error.stack}`);
        } else {
          consoleFn(`  Error: ${String(error)}`);
        }
      }
      if (data) consoleFn(formatHumanData(data));
      return;
    }

    writeServerLog(formattedMessage, stream);
    if (error) {
      if (error instanceof Error) {
        writeServerLog(`  Error: ${error.message}`, stream);
        if (error.stack) writeServerLog(`  Stack: ${error.stack}`, stream);
      } else {
        writeServerLog(`  Error: ${String(error)}`, stream);
      }
    }
    if (data) writeServerLog(formatHumanData(data), stream);
  }

  debug(message: string, data?: LogData): void {
    this.emit('debug', message, data);
  }

  info(message: string, data?: LogData): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: LogData): void {
    this.emit('warn', message, data);
  }

  error(message: string, error?: unknown, data?: LogData): void {
    this.emit('error', message, data, error);
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
