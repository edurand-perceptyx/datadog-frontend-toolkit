/**
 * datadog-frontend-toolkit
 *
 * Enterprise-grade, framework-agnostic frontend observability toolkit for Datadog.
 * Auto-instruments RUM, Logs, Error Tracking, Performance Monitoring,
 * and provisions Dashboards, Monitors & SLOs.
 *
 * @example
 * ```ts
 * import { init } from 'datadog-frontend-toolkit';
 *
 * const observatory = init({
 *   clientToken: 'pub-xxx',
 *   applicationId: 'xxx-xxx-xxx',
 *   service: 'my-frontend-app',
 *   env: 'production',
 *   version: '1.2.3',
 * });
 *
 * // Use the logger
 * observatory.logger.info('Application started');
 * observatory.logger.error('Something failed', new Error('oops'), { orderId: '123' });
 *
 * // Set user context
 * observatory.setUser({ id: 'user-1', name: 'John', email: 'john@example.com' });
 *
 * // Track custom actions
 * observatory.trackAction('checkout_completed', { total: 99.99 });
 *
 * // SPA view tracking
 * observatory.setView('/dashboard');
 * ```
 *
 * @packageDocumentation
 */

import { ObservabilitySDK } from './core/ObservabilitySDK';
import type { ObservabilityConfig } from './types/config';

// ── Main init function ──────────────────────────────────────

/**
 * Initializes the Observability SDK with the given configuration.
 * Call this once at application bootstrap.
 *
 * @param config - SDK configuration. Only `clientToken`, `applicationId`, `service`, and `env` are required.
 * @returns The SDK instance with logger and all observability features.
 */
export function init(config: ObservabilityConfig): ObservabilitySDK {
  return ObservabilitySDK.init(config);
}

/**
 * Returns the current SDK instance, or null if not initialized.
 * Useful for accessing the SDK from anywhere without passing references.
 */
export function getInstance(): ObservabilitySDK | null {
  return ObservabilitySDK.getInstance();
}

/**
 * Shorthand to get the logger from the current SDK instance.
 * Throws if the SDK has not been initialized.
 */
export function getLogger(): ObservabilitySDK['logger'] {
  const instance = ObservabilitySDK.getInstance();
  if (!instance) {
    throw new Error(
      '[dd-frontend-toolkit] SDK not initialized. Call init() first.',
    );
  }
  return instance.logger;
}

// ── Re-exports ──────────────────────────────────────────────

// Core
export { ObservabilitySDK } from './core/ObservabilitySDK';
export { ConfigManager } from './core/ConfigManager';
export { BootstrapGuard } from './core/BootstrapGuard';

// Modules
export { LoggerService, ChildLogger } from './logger/LoggerService';
export { RumManager } from './rum/RumManager';
export { LogsManager } from './logs/LogsManager';
export { ErrorBoundary } from './errors/ErrorBoundary';
export { PerformanceMonitor } from './performance/PerformanceMonitor';
export { NetworkInterceptor } from './network/NetworkInterceptor';
export { ContextManager } from './context/ContextManager';

// Resource provisioning (CLI/server-side only)
export { ResourceProvisioner } from './resources/ResourceProvisioner';

// Utilities
export { Sanitizer } from './utils/sanitizer';
export { EventEmitter } from './utils/EventEmitter';

// Types
export type {
  ObservabilityConfig,
  ResolvedConfig,
  Environment,
  PrivacyLevel,
  SamplingConfig,
  NetworkConfig,
  PerformanceConfig,
  ErrorTrackingConfig,
  SessionConfig,
  UserContext,
  ProvisioningConfig,
  NotificationChannel,
  ActionConfig,
  PrivacyConfig,
  ObservabilityPlugin,
  ObservabilitySDKInterface,
  LifecycleHooks,
} from './types/config';

export { LogLevel } from './types/config';

export type {
  LogEntry,
  SerializedError,
  BrowserInfo,
  MemoryInfo,
  ConnectionInfo,
  LogTransport,
  LogFormatter,
  LoggerConfig,
} from './types/logger';

export { LOG_LEVEL_PRIORITY } from './types/logger';

export type {
  SDKEventPayload,
  ErrorCapturedPayload,
  PerformanceEntryPayload,
  NetworkRequestPayload,
  EventHandler,
  IEventEmitter,
} from './types/events';

export { SDKEvent } from './types/events';
