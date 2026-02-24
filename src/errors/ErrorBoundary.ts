import type { ResolvedConfig } from '../types/config';
import type { LoggerService } from '../logger/LoggerService';
import type { RumManager } from '../rum/RumManager';
import type { ContextManager } from '../context/ContextManager';
import type { EventEmitter } from '../utils/EventEmitter';
import { SDKEvent } from '../types/events';
import type { ErrorCapturedPayload } from '../types/events';

/**
 * Global error boundary that intercepts unhandled errors and promise rejections.
 * Automatically forwards them to Datadog with full context.
 *
 * Features:
 * - Global window.onerror handler
 * - Unhandled promise rejection handler
 * - Error throttling to prevent log flooding
 * - Error pattern filtering
 * - Stack trace enrichment
 *
 * Follows the Chain of Responsibility pattern for error processing.
 */
export class ErrorBoundary {
  private readonly config: ResolvedConfig;
  private readonly logger: LoggerService;
  private readonly rumManager: RumManager;
  private readonly contextManager: ContextManager;
  private readonly emitter: EventEmitter;

  private errorCount = 0;
  private errorWindowStart = Date.now();
  private installed = false;

  private originalOnError: OnErrorEventHandler | null = null;
  private originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;

  private readonly boundErrorHandler: (event: ErrorEvent) => void;
  private readonly boundRejectionHandler: (event: PromiseRejectionEvent) => void;

  constructor(
    config: ResolvedConfig,
    logger: LoggerService,
    rumManager: RumManager,
    contextManager: ContextManager,
    emitter: EventEmitter,
  ) {
    this.config = config;
    this.logger = logger;
    this.rumManager = rumManager;
    this.contextManager = contextManager;
    this.emitter = emitter;

    this.boundErrorHandler = this.handleError.bind(this);
    this.boundRejectionHandler = this.handleRejection.bind(this);
  }

  /**
   * Installs global error handlers.
   */
  install(): void {
    if (this.installed || typeof window === 'undefined') {
      return;
    }

    // Preserve existing handlers
    this.originalOnError = window.onerror;
    this.originalOnUnhandledRejection = window.onunhandledrejection as
      | ((event: PromiseRejectionEvent) => void)
      | null;

    // Install our handlers
    window.addEventListener('error', this.boundErrorHandler);

    if (this.config.errorTracking.unhandledRejections) {
      window.addEventListener('unhandledrejection', this.boundRejectionHandler);
    }

    this.installed = true;
  }

  /**
   * Uninstalls global error handlers and restores originals.
   */
  uninstall(): void {
    if (!this.installed || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.boundErrorHandler);
    window.removeEventListener('unhandledrejection', this.boundRejectionHandler);

    // Restore original handlers
    if (this.originalOnError !== undefined) {
      window.onerror = this.originalOnError;
    }
    if (this.originalOnUnhandledRejection !== undefined) {
      window.onunhandledrejection = this.originalOnUnhandledRejection as OnErrorEventHandler;
    }

    this.installed = false;
  }

  /**
   * Manually capture an error (for framework integrations).
   */
  captureError(error: Error, context?: Record<string, unknown>): void {
    this.processError(error, 'custom', true, context);
  }

  /**
   * Manually capture a message as an error.
   */
  captureMessage(message: string, context?: Record<string, unknown>): void {
    const error = new Error(message);
    error.name = 'CapturedMessage';
    this.processError(error, 'custom', true, context);
  }

  private handleError(event: ErrorEvent): void {
    const error = event.error instanceof Error
      ? event.error
      : new Error(event.message || 'Unknown error');

    if (!(event.error instanceof Error)) {
      error.name = 'UncaughtError';
    }

    const context: Record<string, unknown> = {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    };

    this.processError(error, 'global', false, context);
  }

  private handleRejection(event: PromiseRejectionEvent): void {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(
          typeof event.reason === 'string'
            ? event.reason
            : 'Unhandled promise rejection',
        );

    if (!(event.reason instanceof Error)) {
      error.name = 'UnhandledRejection';
    }

    this.processError(error, 'promise', false, {
      type: 'unhandled_rejection',
    });
  }

  private processError(
    error: Error,
    source: 'global' | 'promise' | 'console' | 'network' | 'custom',
    handled: boolean,
    context?: Record<string, unknown>,
  ): void {
    // Check if error should be ignored
    if (this.shouldIgnore(error)) {
      return;
    }

    // Throttle check
    if (this.isThrottled()) {
      return;
    }

    // Enrich context
    const enrichedContext: Record<string, unknown> = {
      ...context,
      error_source: source,
      handled,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      view: this.contextManager.getView(),
      user_id: this.contextManager.getUser()?.id,
    };

    // Log the error
    this.logger.error(`[${source}] ${error.message}`, error, enrichedContext);

    // Report to RUM
    this.rumManager.addError(error, enrichedContext);

    // Emit event
    const payload: ErrorCapturedPayload = {
      type: SDKEvent.ERROR_CAPTURED,
      timestamp: Date.now(),
      data: {
        error,
        source,
        context: enrichedContext,
        handled,
      },
    };
    this.emitter.emit(SDKEvent.ERROR_CAPTURED, payload);
  }

  private shouldIgnore(error: Error): boolean {
    const message = error.message || '';
    return this.config.errorTracking.ignorePatterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return message.includes(pattern);
      }
      return pattern.test(message);
    });
  }

  private isThrottled(): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Reset window if expired
    if (now - this.errorWindowStart > windowMs) {
      this.errorCount = 0;
      this.errorWindowStart = now;
    }

    this.errorCount++;

    if (this.errorCount > this.config.errorTracking.maxErrorsPerMinute) {
      if (this.errorCount === this.config.errorTracking.maxErrorsPerMinute + 1) {
        // Log throttle activation once
        this.emitter.emit(SDKEvent.THROTTLE_ACTIVATED, {
          type: SDKEvent.THROTTLE_ACTIVATED,
          timestamp: now,
          data: {
            errorsPerMinute: this.errorCount,
            threshold: this.config.errorTracking.maxErrorsPerMinute,
          },
        });
      }
      return true;
    }

    return false;
  }
}
