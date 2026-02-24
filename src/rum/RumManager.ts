import { datadogRum } from '@datadog/browser-rum';
import type { ResolvedConfig, UserContext } from '../types/config';
import type { ContextManager } from '../context/ContextManager';

/**
 * Manages Datadog RUM (Real User Monitoring) initialization and lifecycle.
 * Encapsulates all RUM SDK interactions behind a clean interface.
 * Follows the Facade pattern to simplify RUM SDK complexity.
 */
export class RumManager {
  private readonly config: ResolvedConfig;
  private readonly contextManager: ContextManager;
  private initialized = false;

  constructor(config: ResolvedConfig, contextManager: ContextManager) {
    this.config = config;
    this.contextManager = contextManager;
  }

  /**
   * Initializes the Datadog RUM SDK with resolved configuration.
   */
  init(): void {
    if (this.initialized) {
      return;
    }

    datadogRum.init({
      applicationId: this.config.applicationId,
      clientToken: this.config.clientToken,
      site: this.config.site,
      service: this.config.service,
      env: this.config.env,
      version: this.config.version,
      sessionSampleRate: this.config.sampling.sessionSampleRate,
      sessionReplaySampleRate: this.config.sampling.sessionReplaySampleRate,
      trackUserInteractions: this.config.actions.trackUserInteractions,
      trackResources: true,
      trackLongTasks: this.config.performance.longTasks,
      defaultPrivacyLevel: this.config.privacy.defaultPrivacyLevel,
      allowedTracingUrls: this.config.allowedTracingUrls as Parameters<typeof datadogRum.init>[0]['allowedTracingUrls'],
      proxy: this.config.proxy,
      trackViewsManually: this.config.actions.trackViewsManually,
      ...this.config.rumOverrides,
    });

    // Set initial global context
    const globalContext = this.contextManager.getGlobalContext();
    for (const [key, value] of Object.entries(globalContext)) {
      datadogRum.setGlobalContextProperty(key, value);
    }

    // Set initial user context
    const user = this.contextManager.getUser();
    if (user) {
      this.setUser(user);
    }

    this.initialized = true;
  }

  /**
   * Starts session replay recording.
   */
  startSessionReplay(): void {
    if (!this.initialized) return;
    datadogRum.startSessionReplayRecording();
  }

  /**
   * Stops session replay recording.
   */
  stopSessionReplay(): void {
    if (!this.initialized) return;
    datadogRum.stopSessionReplayRecording();
  }

  /**
   * Sets user information in RUM context.
   */
  setUser(user: UserContext): void {
    if (!this.initialized) return;
    datadogRum.setUser({
      id: user.id,
      name: user.name,
      email: user.email,
      ...user,
    });
  }

  /**
   * Clears user information from RUM context.
   */
  clearUser(): void {
    if (!this.initialized) return;
    datadogRum.clearUser();
  }

  /**
   * Sets a global context property.
   */
  setGlobalContext(key: string, value: unknown): void {
    if (!this.initialized) return;
    datadogRum.setGlobalContextProperty(key, value);
  }

  /**
   * Removes a global context property.
   */
  removeGlobalContext(key: string): void {
    if (!this.initialized) return;
    datadogRum.removeGlobalContextProperty(key);
  }

  /**
   * Adds a custom action event.
   */
  addAction(name: string, context?: Record<string, unknown>): void {
    if (!this.initialized) return;
    datadogRum.addAction(name, context);
  }

  /**
   * Adds a custom error to RUM.
   */
  addError(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) return;
    datadogRum.addError(error, context);
  }

  /**
   * Adds a custom timing measurement.
   */
  addTiming(name: string, time?: number): void {
    if (!this.initialized) return;
    datadogRum.addTiming(name, time);
  }

  /**
   * Starts a new RUM view.
   */
  startView(name: string): void {
    if (!this.initialized) return;
    datadogRum.startView({ name });
  }

  /**
   * Gets the current RUM internal context (session ID, view ID, etc.).
   */
  getInternalContext(): Record<string, unknown> | undefined {
    if (!this.initialized) return undefined;
    return datadogRum.getInternalContext() as Record<string, unknown> | undefined;
  }

  /**
   * Returns whether the SDK is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Stops RUM collection. Cannot be restarted.
   */
  stop(): void {
    // Datadog RUM SDK doesn't have an explicit stop method —
    // we simply mark as uninitialized to prevent further operations.
    this.initialized = false;
  }
}
