import { datadogLogs } from '@datadog/browser-logs';
import type { ResolvedConfig } from '../types/config';
import { LogLevel } from '../types/config';
import type { ContextManager } from '../context/ContextManager';
import type { SerializedError } from '../types/logger';

type DatadogLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Manages Datadog Browser Logs SDK initialization and log forwarding.
 * Acts as the transport layer between LoggerService and Datadog.
 * Follows the Adapter pattern to normalize log levels and context.
 */
export class LogsManager {
  private readonly config: ResolvedConfig;
  private readonly contextManager: ContextManager;
  private initialized = false;

  constructor(config: ResolvedConfig, contextManager: ContextManager) {
    this.config = config;
    this.contextManager = contextManager;
  }

  /**
   * Initializes the Datadog Browser Logs SDK.
   */
  init(): void {
    if (this.initialized) {
      return;
    }

    datadogLogs.init({
      clientToken: this.config.clientToken,
      site: this.config.site,
      service: this.config.service,
      env: this.config.env,
      version: this.config.version,
      forwardErrorsToLogs: this.config.errorTracking.consoleErrors,
      forwardConsoleLogs: this.config.debug ? 'all' : [],
      sessionSampleRate: this.config.sampling.logSampleRate,
      proxy: this.config.proxy,
      ...this.config.logsOverrides,
    });

    // Set initial global context
    const globalContext = this.contextManager.getGlobalContext();
    for (const [key, value] of Object.entries(globalContext)) {
      datadogLogs.setGlobalContextProperty(key, value);
    }

    // Set user context
    const user = this.contextManager.getUser();
    if (user) {
      datadogLogs.setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        ...user,
      });
    }

    this.initialized = true;
  }

  /**
   * Sends a log entry to Datadog.
   */
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: SerializedError,
  ): void {
    if (!this.initialized) return;

    const enrichedContext = {
      ...this.contextManager.getFullContext(),
      ...context,
      ...(error ? { error } : {}),
    };

    const ddLevel = this.mapLogLevel(level);
    datadogLogs.logger[ddLevel](message, enrichedContext);
  }

  /**
   * Sets a global context property in Logs SDK.
   */
  setGlobalContext(key: string, value: unknown): void {
    if (!this.initialized) return;
    datadogLogs.setGlobalContextProperty(key, value);
  }

  /**
   * Removes a global context property from Logs SDK.
   */
  removeGlobalContext(key: string): void {
    if (!this.initialized) return;
    datadogLogs.removeGlobalContextProperty(key);
  }

  /**
   * Returns whether the Logs SDK is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Maps toolkit log levels to Datadog SDK log levels.
   * CRITICAL maps to 'error' since Datadog SDK doesn't have a critical level.
   */
  private mapLogLevel(level: LogLevel): DatadogLogLevel {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }
}
