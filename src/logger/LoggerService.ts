import { LogLevel } from '../types/config';
import type { LogEntry, SerializedError } from '../types/logger';
import { LOG_LEVEL_PRIORITY } from '../types/logger';
import type { LogsManager } from '../logs/LogsManager';
import type { ContextManager } from '../context/ContextManager';
import type { EventEmitter } from '../utils/EventEmitter';
import { SDKEvent } from '../types/events';
import { Sanitizer } from '../utils/sanitizer';
import { generateErrorFingerprint } from '../utils/fingerprint';

/**
 * Enterprise-grade logger service with structured logging, context enrichment,
 * automatic Datadog forwarding, and PII sanitization.
 *
 * Supports all standard log levels: debug, info, warn, error, critical.
 * Warns and errors are automatically forwarded to Datadog.
 *
 * Usage:
 *   const logger = observatory.getLogger();
 *   logger.info('User signed in', { userId: '123' });
 *   logger.error('Payment failed', new Error('timeout'), { orderId: 'abc' });
 */
export class LoggerService {
  private readonly logsManager: LogsManager;
  private readonly contextManager: ContextManager;
  private readonly emitter: EventEmitter;
  private readonly sanitizer: Sanitizer;
  private readonly minLevel: LogLevel;
  private readonly consoleOutput: boolean;
  private readonly service: string;
  private readonly env: string;
  private readonly version: string;
  private scopeContext: Record<string, unknown> = {};

  constructor(
    logsManager: LogsManager,
    contextManager: ContextManager,
    emitter: EventEmitter,
    options: {
      minLevel: LogLevel;
      consoleOutput: boolean;
      service: string;
      env: string;
      version: string;
      piiFields?: string[];
    },
  ) {
    this.logsManager = logsManager;
    this.contextManager = contextManager;
    this.emitter = emitter;
    this.sanitizer = new Sanitizer(options.piiFields);
    this.minLevel = options.minLevel;
    this.consoleOutput = options.consoleOutput;
    this.service = options.service;
    this.env = options.env;
    this.version = options.version;
  }

  /**
   * Creates a child logger with additional scoped context.
   * Useful for module-specific logging without polluting global context.
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Logs a debug message. Not sent to Datadog by default.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * Logs an informational message.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  /**
   * Logs a warning. Automatically forwarded to Datadog.
   */
  warn(message: string, context?: Record<string, unknown>): void;
  warn(message: string, error: Error, context?: Record<string, unknown>): void;
  warn(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    const { error, ctx } = this.parseErrorArgs(errorOrContext, context);
    this.log(LogLevel.WARN, message, error, ctx);
  }

  /**
   * Logs an error. Automatically forwarded to Datadog.
   */
  error(message: string, context?: Record<string, unknown>): void;
  error(message: string, error: Error, context?: Record<string, unknown>): void;
  error(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    const { error, ctx } = this.parseErrorArgs(errorOrContext, context);
    this.log(LogLevel.ERROR, message, error, ctx);
  }

  /**
   * Logs a critical error. Always forwarded to Datadog.
   * Use for unrecoverable errors that need immediate attention.
   */
  critical(message: string, context?: Record<string, unknown>): void;
  critical(message: string, error: Error, context?: Record<string, unknown>): void;
  critical(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    const { error, ctx } = this.parseErrorArgs(errorOrContext, context);
    this.log(LogLevel.CRITICAL, message, error, ctx);
  }

  /**
   * Measures execution time of an async operation.
   */
  async time<T>(label: string, fn: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`${label} completed`, { ...context, duration_ms: Math.round(duration) });
      return result;
    } catch (err) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, err instanceof Error ? err : new Error(String(err)), {
        ...context,
        duration_ms: Math.round(duration),
      });
      throw err;
    }
  }

  /**
   * Adds persistent context to this logger instance.
   */
  setContext(context: Record<string, unknown>): void {
    this.scopeContext = { ...this.scopeContext, ...context };
  }

  /**
   * Clears scoped context.
   */
  clearContext(): void {
    this.scopeContext = {};
  }

  /** @internal Core log method */
  log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const serializedError = error ? this.serializeError(error) : undefined;

    const mergedContext = this.sanitizer.sanitize({
      ...this.scopeContext,
      ...context,
    }) as Record<string, unknown>;

    const entry: LogEntry = {
      level,
      message: this.sanitizer.sanitizeString(message),
      timestamp: new Date().toISOString(),
      service: this.service,
      env: this.env,
      version: this.version,
      context: mergedContext,
      error: serializedError,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      view: this.contextManager.getView(),
      user: this.contextManager.getUser() as Record<string, unknown> | undefined,
      fingerprint: serializedError?.fingerprint,
      tags: [],
    };

    // Console output
    if (this.consoleOutput) {
      this.writeToConsole(entry);
    }

    // Forward to Datadog (warn, error, critical always; others based on config)
    if (this.shouldForwardToDatadog(level)) {
      this.logsManager.log(level, entry.message, mergedContext, serializedError);
    }

    // Emit event
    this.emitter.emit(SDKEvent.LOG_SENT, {
      type: SDKEvent.LOG_SENT,
      timestamp: Date.now(),
      data: { level, message: entry.message },
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private shouldForwardToDatadog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[LogLevel.WARN];
  }

  private serializeError(error: Error): SerializedError {
    return {
      name: error.name,
      message: this.sanitizer.sanitizeString(error.message),
      stack: error.stack ? this.sanitizer.sanitizeString(error.stack) : undefined,
      cause: error.cause instanceof Error ? this.serializeError(error.cause) : undefined,
      type: error.constructor.name,
      fingerprint: generateErrorFingerprint(error),
      metadata: this.extractErrorMetadata(error),
    };
  }

  private extractErrorMetadata(error: Error): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    const knownKeys = new Set(['name', 'message', 'stack', 'cause']);

    for (const key of Object.getOwnPropertyNames(error)) {
      if (!knownKeys.has(key)) {
        metadata[key] = (error as unknown as Record<string, unknown>)[key];
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  private parseErrorArgs(
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): { error?: Error; ctx?: Record<string, unknown> } {
    if (errorOrContext instanceof Error) {
      return { error: errorOrContext, ctx: context };
    }
    return { error: undefined, ctx: errorOrContext };
  }

  private writeToConsole(entry: LogEntry): void {
    const prefix = `[${entry.service}] [${entry.level.toUpperCase()}]`;
    const args: unknown[] = [prefix, entry.message];

    if (entry.context && Object.keys(entry.context).length > 0) {
      args.push(entry.context);
    }

    if (entry.error) {
      args.push(entry.error);
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(...args);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(...args);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(...args);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        // eslint-disable-next-line no-console
        console.error(...args);
        break;
    }
  }
}

/**
 * Child logger with scoped context.
 * Delegates all logging to the parent LoggerService.
 */
export class ChildLogger {
  private readonly parent: LoggerService;
  private readonly childContext: Record<string, unknown>;

  constructor(parent: LoggerService, context: Record<string, unknown>) {
    this.parent = parent;
    this.childContext = context;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.log(LogLevel.DEBUG, message, undefined, { ...this.childContext, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.log(LogLevel.INFO, message, undefined, { ...this.childContext, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void;
  warn(message: string, error: Error, context?: Record<string, unknown>): void;
  warn(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    if (errorOrContext instanceof Error) {
      this.parent.log(LogLevel.WARN, message, errorOrContext, { ...this.childContext, ...context });
    } else {
      this.parent.log(LogLevel.WARN, message, undefined, { ...this.childContext, ...errorOrContext });
    }
  }

  error(message: string, context?: Record<string, unknown>): void;
  error(message: string, error: Error, context?: Record<string, unknown>): void;
  error(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    if (errorOrContext instanceof Error) {
      this.parent.log(LogLevel.ERROR, message, errorOrContext, { ...this.childContext, ...context });
    } else {
      this.parent.log(LogLevel.ERROR, message, undefined, { ...this.childContext, ...errorOrContext });
    }
  }

  critical(message: string, context?: Record<string, unknown>): void;
  critical(message: string, error: Error, context?: Record<string, unknown>): void;
  critical(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    if (errorOrContext instanceof Error) {
      this.parent.log(LogLevel.CRITICAL, message, errorOrContext, { ...this.childContext, ...context });
    } else {
      this.parent.log(LogLevel.CRITICAL, message, undefined, { ...this.childContext, ...errorOrContext });
    }
  }

  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this.parent, { ...this.childContext, ...context });
  }
}
