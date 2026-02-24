import type {
  ObservabilityConfig,
  ResolvedConfig,
  UserContext,
  ObservabilitySDKInterface,
  ObservabilityPlugin,
} from '../types/config';
import { SDKEvent } from '../types/events';
import type { EventHandler } from '../types/events';
import { ConfigManager } from './ConfigManager';
import { BootstrapGuard } from './BootstrapGuard';
import { ContextManager } from '../context/ContextManager';
import { RumManager } from '../rum/RumManager';
import { LogsManager } from '../logs/LogsManager';
import { LoggerService } from '../logger/LoggerService';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { NetworkInterceptor } from '../network/NetworkInterceptor';
import { EventEmitter } from '../utils/EventEmitter';

/**
 * Main orchestrator for the Observability Toolkit.
 *
 * Implements the Facade pattern to provide a single entry point
 * for all observability features. Manages the lifecycle of all
 * sub-modules and coordinates initialization.
 *
 * Usage:
 * ```ts
 * import { init } from 'datadog-frontend-toolkit';
 *
 * const observatory = init({
 *   clientToken: 'pub-xxx',
 *   applicationId: 'xxx',
 *   service: 'my-app',
 *   env: 'production',
 * });
 *
 * const logger = observatory.logger;
 * logger.info('App started');
 * ```
 */
export class ObservabilitySDK implements ObservabilitySDKInterface {
  private static instance: ObservabilitySDK | null = null;

  private readonly config: ResolvedConfig;
  private readonly emitter: EventEmitter;
  private readonly contextManager: ContextManager;
  private readonly rumManager: RumManager;
  private readonly logsManager: LogsManager;
  private readonly errorBoundary: ErrorBoundary;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly networkInterceptor: NetworkInterceptor;

  /** Public logger instance */
  public readonly logger: LoggerService;

  private destroyed = false;

  private constructor(config: ObservabilityConfig) {
    // Apply lifecycle hook
    const finalConfig = config.hooks?.beforeInit?.(config) ?? config;

    // Resolve config with defaults
    this.config = ConfigManager.resolve(finalConfig);

    // Initialize core infrastructure
    this.emitter = new EventEmitter();
    this.contextManager = new ContextManager(this.config, this.emitter);

    // Initialize Datadog SDKs
    this.rumManager = new RumManager(this.config, this.contextManager);
    this.logsManager = new LogsManager(this.config, this.contextManager);

    // Initialize logger
    this.logger = new LoggerService(this.logsManager, this.contextManager, this.emitter, {
      minLevel: this.config.logLevel,
      consoleOutput: this.config.consoleOutput,
      service: this.config.service,
      env: this.config.env,
      version: this.config.version,
      piiFields: this.config.privacy.piiFields,
    });

    // Initialize error boundary
    this.errorBoundary = new ErrorBoundary(
      this.config,
      this.logger,
      this.rumManager,
      this.contextManager,
      this.emitter,
    );

    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor(
      this.config,
      this.logger,
      this.rumManager,
      this.emitter,
    );

    // Initialize network interceptor
    this.networkInterceptor = new NetworkInterceptor(this.config, this.logger, this.emitter);
  }

  /**
   * Initializes the Observability SDK.
   * This is the main entry point — call once at application bootstrap.
   *
   * Returns the SDK instance (singleton). Subsequent calls return the same instance.
   */
  static init(config: ObservabilityConfig): ObservabilitySDK {
    const guard = BootstrapGuard.getInstance();

    // Prevent double initialization
    if (ObservabilitySDK.instance && !ObservabilitySDK.instance.destroyed) {
      if (ObservabilitySDK.instance.config.debug) {
        // eslint-disable-next-line no-console
        console.warn('[dd-frontend-toolkit] SDK already initialized. Returning existing instance.');
      }
      return ObservabilitySDK.instance;
    }

    const sdk = new ObservabilitySDK(config);
    ObservabilitySDK.instance = sdk;

    // Track bootstrap
    const isFirstBoot = guard.isFirstBootstrap(sdk.config.service, sdk.config.env);
    guard.markInitialized(sdk.config.service, sdk.config.env, sdk.config.version);

    // Boot all modules
    sdk.boot(isFirstBoot);

    return sdk;
  }

  /**
   * Returns the current SDK instance, or null if not initialized.
   */
  static getInstance(): ObservabilitySDK | null {
    return ObservabilitySDK.instance;
  }

  /**
   * Destroys the SDK and cleans up all handlers.
   */
  async destroy(): Promise<void> {
    if (this.destroyed) return;

    // Teardown plugins
    for (const plugin of this.config.plugins) {
      try {
        await plugin.teardown?.();
      } catch {
        // Swallow plugin teardown errors
      }
    }

    this.errorBoundary.uninstall();
    this.networkInterceptor.uninstall();
    this.performanceMonitor.stop();
    this.rumManager.stop();
    this.emitter.removeAllListeners();

    this.destroyed = true;
    ObservabilitySDK.instance = null;

    this.emitter.emit(SDKEvent.DESTROYED, {
      type: SDKEvent.DESTROYED,
      timestamp: Date.now(),
    });
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Sets the current user context across all Datadog modules.
   */
  setUser(user: UserContext): void {
    this.contextManager.setUser(user);
    this.rumManager.setUser(user);
  }

  /**
   * Clears the current user context.
   */
  clearUser(): void {
    this.contextManager.clearUser();
    this.rumManager.clearUser();
  }

  /**
   * Adds a key-value pair to the global context.
   */
  addGlobalContext(key: string, value: unknown): void {
    this.contextManager.setGlobalContext(key, value);
    this.rumManager.setGlobalContext(key, value);
    this.logsManager.setGlobalContext(key, value);
  }

  /**
   * Removes a key from the global context.
   */
  removeGlobalContext(key: string): void {
    this.contextManager.removeGlobalContext(key);
    this.rumManager.removeGlobalContext(key);
    this.logsManager.removeGlobalContext(key);
  }

  /**
   * Sets the current view/route name.
   * Use this when navigating between pages in SPAs.
   */
  setView(name: string): void {
    this.contextManager.setView(name);
    if (this.config.actions.trackViewsManually) {
      this.rumManager.startView(name);
    }
  }

  /**
   * Tracks a custom user action.
   */
  trackAction(name: string, context?: Record<string, unknown>): void {
    this.rumManager.addAction(name, context);
  }

  /**
   * Manually captures an error and sends it to Datadog.
   */
  captureError(error: Error, context?: Record<string, unknown>): void {
    this.errorBoundary.captureError(error, context);
  }

  /**
   * Captures a message as an error-level event.
   */
  captureMessage(message: string, context?: Record<string, unknown>): void {
    this.errorBoundary.captureMessage(message, context);
  }

  /**
   * Records a custom performance timing.
   */
  addTiming(name: string, duration?: number): void {
    this.rumManager.addTiming(name, duration);
  }

  /**
   * Marks a performance checkpoint.
   */
  mark(name: string): void {
    this.performanceMonitor.mark(name);
  }

  /**
   * Measures time between two performance marks.
   */
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    return this.performanceMonitor.measure(name, startMark, endMark);
  }

  /**
   * Starts session replay recording.
   */
  startSessionReplay(): void {
    this.rumManager.startSessionReplay();
  }

  /**
   * Stops session replay recording.
   */
  stopSessionReplay(): void {
    this.rumManager.stopSessionReplay();
  }

  /**
   * Grants consent for tracking (when privacy.requireConsent is true).
   */
  grantConsent(): void {
    this.emitter.emit(SDKEvent.CONSENT_GRANTED, {
      type: SDKEvent.CONSENT_GRANTED,
      timestamp: Date.now(),
    });
  }

  /**
   * Revokes consent for tracking.
   */
  revokeConsent(): void {
    this.emitter.emit(SDKEvent.CONSENT_REVOKED, {
      type: SDKEvent.CONSENT_REVOKED,
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribes to SDK lifecycle events.
   */
  onEvent(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event as SDKEvent, handler as EventHandler);
  }

  /**
   * Unsubscribes from SDK lifecycle events.
   */
  offEvent(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event as SDKEvent, handler as EventHandler);
  }

  /**
   * Returns the resolved (with defaults) configuration.
   */
  getConfig(): Readonly<ResolvedConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Returns the RUM internal context (session ID, view ID, etc.).
   */
  getRumContext(): Record<string, unknown> | undefined {
    return this.rumManager.getInternalContext();
  }

  /**
   * Returns whether the SDK has been initialized and is active.
   */
  isActive(): boolean {
    return !this.destroyed;
  }

  // ── Private Boot Sequence ───────────────────────────────────

  private boot(isFirstBoot: boolean): void {
    // 1. Initialize Datadog SDKs
    this.rumManager.init();
    this.logsManager.init();

    // 2. Install error boundary
    if (this.config.errorTracking.enabled) {
      this.errorBoundary.install();
    }

    // 3. Start performance monitoring
    if (this.config.performance.webVitals || this.config.performance.longTasks) {
      this.performanceMonitor.start();
    }

    // 4. Install network interceptor
    if (this.config.network.enabled) {
      this.networkInterceptor.install();
    }

    // 5. Start session replay if configured
    if (this.config.sampling.sessionReplaySampleRate > 0) {
      this.rumManager.startSessionReplay();
    }

    // 6. Load plugins
    this.loadPlugins();

    // 7. Log initialization
    this.logger.info('Observability SDK initialized', {
      service: this.config.service,
      env: this.config.env,
      version: this.config.version,
      isFirstBoot,
      features: {
        rum: this.rumManager.isInitialized(),
        logs: this.logsManager.isInitialized(),
        errorTracking: this.config.errorTracking.enabled,
        performanceMonitoring: this.config.performance.webVitals,
        networkInterception: this.config.network.enabled,
        sessionReplay: this.config.sampling.sessionReplaySampleRate > 0,
      },
    });

    // 8. Emit initialized event
    this.emitter.emit(SDKEvent.INITIALIZED, {
      type: SDKEvent.INITIALIZED,
      timestamp: Date.now(),
      data: { isFirstBoot },
    });

    // 9. Call afterInit hook
    this.config.hooks.afterInit?.();
  }

  private loadPlugins(): void {
    for (const plugin of this.config.plugins) {
      this.loadPlugin(plugin);
    }
  }

  private loadPlugin(plugin: ObservabilityPlugin): void {
    try {
      plugin.setup(this);

      this.emitter.emit(SDKEvent.PLUGIN_LOADED, {
        type: SDKEvent.PLUGIN_LOADED,
        timestamp: Date.now(),
        data: { name: plugin.name, version: plugin.version },
      });

      if (this.config.debug) {
        this.logger.debug(`Plugin loaded: ${plugin.name}@${plugin.version}`);
      }
    } catch (error) {
      this.emitter.emit(SDKEvent.PLUGIN_ERROR, {
        type: SDKEvent.PLUGIN_ERROR,
        timestamp: Date.now(),
        data: {
          name: plugin.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `Failed to load plugin: ${plugin.name}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /** @internal For testing only */
  static resetInstance(): void {
    ObservabilitySDK.instance = null;
    BootstrapGuard.resetInstance();
  }
}
