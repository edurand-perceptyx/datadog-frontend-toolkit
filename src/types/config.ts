import type { RumInitConfiguration } from '@datadog/browser-rum';
import type { LogsInitConfiguration } from '@datadog/browser-logs';

/** Log levels supported by the toolkit */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/** Environment identifiers */
export type Environment = 'production' | 'staging' | 'development' | 'test' | string;

/** Privacy levels for session replay */
export type PrivacyLevel = 'mask' | 'mask-user-input' | 'allow';

/** Sampling configuration */
export interface SamplingConfig {
  /** RUM session sample rate (0-100). Default: 100 */
  sessionSampleRate?: number;
  /** Session replay sample rate (0-100). Default: 20 */
  sessionReplaySampleRate?: number;
  /** Trace sample rate for APM correlation (0-100). Default: 100 */
  traceSampleRate?: number;
  /** Log sample rate (0-100). Default: 100 */
  logSampleRate?: number;
}

/** Network monitoring configuration */
export interface NetworkConfig {
  /** Enable automatic XHR/Fetch interception. Default: true */
  enabled?: boolean;
  /** URL patterns to exclude from tracking (regex strings) */
  excludeUrls?: (string | RegExp)[];
  /** Track request/response headers. Default: false */
  trackHeaders?: boolean;
  /** Track request/response bodies. Default: false */
  trackBodies?: boolean;
  /** Max body size to capture in bytes. Default: 4096 */
  maxBodySize?: number;
  /** Track failed requests only. Default: false */
  failedOnly?: boolean;
}

/** Performance monitoring configuration */
export interface PerformanceConfig {
  /** Enable Web Vitals tracking. Default: true */
  webVitals?: boolean;
  /** Enable Long Task detection. Default: true */
  longTasks?: boolean;
  /** Long task threshold in ms. Default: 50 */
  longTaskThreshold?: number;
  /** Enable resource timing. Default: true */
  resourceTiming?: boolean;
  /** Enable First Input Delay tracking. Default: true */
  firstInputDelay?: boolean;
  /** Enable Cumulative Layout Shift tracking. Default: true */
  cumulativeLayoutShift?: boolean;
  /** Enable Largest Contentful Paint tracking. Default: true */
  largestContentfulPaint?: boolean;
  /** Enable Interaction to Next Paint tracking. Default: true */
  interactionToNextPaint?: boolean;
  /** Custom performance marks to track */
  customMarks?: string[];
}

/** Error tracking configuration */
export interface ErrorTrackingConfig {
  /** Enable global error handler. Default: true */
  enabled?: boolean;
  /** Enable unhandled promise rejection tracking. Default: true */
  unhandledRejections?: boolean;
  /** Enable console.error interception. Default: true */
  consoleErrors?: boolean;
  /** Error patterns to ignore (matched against message) */
  ignorePatterns?: (string | RegExp)[];
  /** Max errors per minute before throttling. Default: 100 */
  maxErrorsPerMinute?: number;
  /** Capture component stack traces. Default: true */
  captureStackTraces?: boolean;
  /** Custom error fingerprinting function */
  fingerprint?: (error: Error) => string;
}

/** Session configuration */
export interface SessionConfig {
  /** Enable session tracking. Default: true */
  enabled?: boolean;
  /** Session timeout in ms. Default: 1800000 (30 min) */
  timeout?: number;
  /** Enable cross-tab session sharing. Default: true */
  crossTabSync?: boolean;
}

/** User context for all events */
export interface UserContext {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

/** Resource provisioning configuration (for CLI/server-side) */
export interface ProvisioningConfig {
  /** Datadog API key (DD_API_KEY) - NEVER use in browser */
  apiKey: string;
  /** Datadog Application key (DD_APP_KEY) - NEVER use in browser */
  appKey: string;
  /** Datadog site. Default: 'datadoghq.com' */
  site?: string;
  /** Enable dashboard provisioning. Default: true */
  dashboards?: boolean;
  /** Enable monitor provisioning. Default: true */
  monitors?: boolean;
  /** Enable SLO provisioning. Default: true */
  slos?: boolean;
  /** Custom tags for provisioned resources */
  tags?: string[];
  /** Team name for resource ownership */
  team?: string;
  /** Notification channels for alerts */
  notificationChannels?: NotificationChannel[];
  /** Force update existing resources instead of skipping them */
  force?: boolean;
}

/** Notification channel configuration */
export interface NotificationChannel {
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'opsgenie';
  target: string;
}

/** Custom action tracking */
export interface ActionConfig {
  /** Enable automatic action tracking (clicks, etc). Default: true */
  trackUserInteractions?: boolean;
  /** Enable frustration signal tracking. Default: true */
  trackFrustrations?: boolean;
  /** Track view name changes. Default: true */
  trackViewsManually?: boolean;
}

/** Privacy and compliance configuration */
export interface PrivacyConfig {
  /** Default privacy level for session replay. Default: 'mask-user-input' */
  defaultPrivacyLevel?: PrivacyLevel;
  /** PII fields to automatically redact from logs */
  piiFields?: string[];
  /** Enable cookie consent mode. Default: false */
  requireConsent?: boolean;
  /** Allowed tracking purposes when consent is required */
  consentPurposes?: string[];
}

/** Plugin interface for extensibility */
export interface ObservabilityPlugin {
  /** Unique plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Called during SDK initialization */
  setup(sdk: ObservabilitySDKInterface): void | Promise<void>;
  /** Called during SDK teardown */
  teardown?(): void | Promise<void>;
}

/** SDK interface exposed to plugins */
export interface ObservabilitySDKInterface {
  getConfig(): Readonly<ResolvedConfig>;
  addGlobalContext(key: string, value: unknown): void;
  removeGlobalContext(key: string): void;
  onEvent(event: string, handler: (...args: unknown[]) => void): void;
}

/** Hooks for lifecycle events */
export interface LifecycleHooks {
  /** Called before SDK initialization */
  beforeInit?: (config: ObservabilityConfig) => ObservabilityConfig | void;
  /** Called after SDK initialization */
  afterInit?: () => void;
  /** Called before each log is sent */
  beforeLog?: (level: LogLevel, message: string, context?: Record<string, unknown>) => boolean;
  /** Called before each error is sent */
  beforeError?: (error: Error, context?: Record<string, unknown>) => boolean;
  /** Called on session start */
  onSessionStart?: (sessionId: string) => void;
  /** Called on session end */
  onSessionEnd?: (sessionId: string) => void;
}

/**
 * Main configuration interface for the Observability Toolkit.
 * Only `clientToken`, `applicationId`, `service`, and `env` are required.
 */
export interface ObservabilityConfig {
  // ── Required ──────────────────────────────────────────────
  /** Datadog Client Token */
  clientToken: string;
  /** Datadog RUM Application ID */
  applicationId: string;
  /** Service name (e.g., 'my-frontend-app') */
  service: string;
  /** Environment identifier */
  env: Environment;

  // ── Optional Core ─────────────────────────────────────────
  /** Application version. Default: '0.0.0' */
  version?: string;
  /** Datadog site. Default: 'datadoghq.com' */
  site?: string;
  /** Enable debug mode (verbose console output). Default: false */
  debug?: boolean;
  /** Minimum log level to send to Datadog. Default: LogLevel.WARN */
  logLevel?: LogLevel;
  /** Enable console logging in addition to Datadog. Default: true in dev */
  consoleOutput?: boolean;

  // ── Feature Configs ───────────────────────────────────────
  /** Sampling configuration */
  sampling?: SamplingConfig;
  /** Network monitoring configuration */
  network?: NetworkConfig;
  /** Performance monitoring configuration */
  performance?: PerformanceConfig;
  /** Error tracking configuration */
  errorTracking?: ErrorTrackingConfig;
  /** Session configuration */
  session?: SessionConfig;
  /** User action tracking configuration */
  actions?: ActionConfig;
  /** Privacy and compliance configuration */
  privacy?: PrivacyConfig;

  // ── Context ───────────────────────────────────────────────
  /** Initial user context */
  user?: UserContext;
  /** Global context attached to all events */
  globalContext?: Record<string, unknown>;
  /** Custom tags for all events */
  tags?: string[];

  // ── Extensibility ─────────────────────────────────────────
  /** Plugins to register */
  plugins?: ObservabilityPlugin[];
  /** Lifecycle hooks */
  hooks?: LifecycleHooks;

  // ── Advanced ──────────────────────────────────────────────
  /** Proxy URL for Datadog intake. Useful for ad-blockers */
  proxy?: string;
  /** Allowed tracing origins for APM correlation */
  allowedTracingUrls?: (string | RegExp | { match: string | RegExp; propagatorTypes: string[] })[];
  /** Custom RUM configuration overrides (advanced) */
  rumOverrides?: Partial<RumInitConfiguration>;
  /** Custom Logs configuration overrides (advanced) */
  logsOverrides?: Partial<LogsInitConfiguration>;
  /** Resource provisioning config (CLI only, never browser) */
  provisioning?: ProvisioningConfig;
}

/**
 * Resolved configuration with all defaults applied.
 * All optional fields become required with their default values.
 */
export interface ResolvedConfig extends Required<Pick<ObservabilityConfig,
  'clientToken' | 'applicationId' | 'service' | 'env' | 'version' | 'site' | 'debug' | 'logLevel' | 'consoleOutput'
>> {
  sampling: Required<SamplingConfig>;
  network: Required<Omit<NetworkConfig, 'excludeUrls'>> & { excludeUrls: (string | RegExp)[] };
  performance: Required<Omit<PerformanceConfig, 'customMarks'>> & { customMarks: string[] };
  errorTracking: Required<Omit<ErrorTrackingConfig, 'ignorePatterns' | 'fingerprint'>> & {
    ignorePatterns: (string | RegExp)[];
    fingerprint?: (error: Error) => string;
  };
  session: Required<SessionConfig>;
  actions: Required<ActionConfig>;
  privacy: Required<Omit<PrivacyConfig, 'piiFields' | 'consentPurposes'>> & {
    piiFields: string[];
    consentPurposes: string[];
  };
  user?: UserContext;
  globalContext: Record<string, unknown>;
  tags: string[];
  plugins: ObservabilityPlugin[];
  hooks: LifecycleHooks;
  proxy?: string;
  allowedTracingUrls: (string | RegExp | { match: string | RegExp; propagatorTypes: string[] })[];
  rumOverrides: Partial<RumInitConfiguration>;
  logsOverrides: Partial<LogsInitConfiguration>;
  provisioning?: ProvisioningConfig;
}
