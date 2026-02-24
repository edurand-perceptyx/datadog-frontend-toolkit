import type { ResolvedConfig, UserContext } from '../types/config';
import type { BrowserInfo, ConnectionInfo, MemoryInfo } from '../types/logger';
import { SDKEvent } from '../types/events';
import type { EventEmitter } from '../utils/EventEmitter';

/**
 * Centralized context management for enriching all events with
 * browser, user, session, and application metadata.
 * Implements the Mediator pattern to share context across modules.
 */
export class ContextManager {
  private globalContext: Record<string, unknown>;
  private userContext: UserContext | undefined;
  private readonly config: ResolvedConfig;
  private readonly emitter: EventEmitter;
  private viewName: string | undefined;
  private cachedBrowserInfo: BrowserInfo | undefined;

  constructor(config: ResolvedConfig, emitter: EventEmitter) {
    this.config = config;
    this.emitter = emitter;
    this.globalContext = { ...config.globalContext };
    this.userContext = config.user ? { ...config.user } : undefined;
  }

  /**
   * Returns the full context snapshot to attach to logs and events.
   */
  getFullContext(): Record<string, unknown> {
    return {
      ...this.globalContext,
      service: this.config.service,
      env: this.config.env,
      version: this.config.version,
      url: this.getCurrentUrl(),
      view: this.viewName,
      browser: this.getBrowserInfo(),
      user: this.userContext,
      tags: this.config.tags,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns only the global context (without browser info).
   */
  getGlobalContext(): Record<string, unknown> {
    return { ...this.globalContext };
  }

  /**
   * Sets a key-value pair in the global context.
   */
  setGlobalContext(key: string, value: unknown): void {
    this.globalContext[key] = value;
    this.emitter.emit(SDKEvent.CONTEXT_UPDATED, {
      type: SDKEvent.CONTEXT_UPDATED,
      timestamp: Date.now(),
      data: { key, value },
    });
  }

  /**
   * Removes a key from the global context.
   */
  removeGlobalContext(key: string): void {
    delete this.globalContext[key];
    this.emitter.emit(SDKEvent.CONTEXT_UPDATED, {
      type: SDKEvent.CONTEXT_UPDATED,
      timestamp: Date.now(),
      data: { key, removed: true },
    });
  }

  /**
   * Sets user context.
   */
  setUser(user: UserContext): void {
    this.userContext = { ...user };
    this.emitter.emit(SDKEvent.USER_SET, {
      type: SDKEvent.USER_SET,
      timestamp: Date.now(),
      data: { userId: user.id },
    });
  }

  /**
   * Clears user context.
   */
  clearUser(): void {
    this.userContext = undefined;
  }

  /**
   * Gets current user context.
   */
  getUser(): UserContext | undefined {
    return this.userContext ? { ...this.userContext } : undefined;
  }

  /**
   * Sets the current view/route name.
   */
  setView(name: string): void {
    this.viewName = name;
    this.emitter.emit(SDKEvent.VIEW_CHANGED, {
      type: SDKEvent.VIEW_CHANGED,
      timestamp: Date.now(),
      data: { view: name },
    });
  }

  /**
   * Gets the current view/route name.
   */
  getView(): string | undefined {
    return this.viewName;
  }

  /**
   * Collects browser and device information.
   * Cached after first call since these values rarely change.
   */
  getBrowserInfo(): BrowserInfo {
    if (this.cachedBrowserInfo) {
      return {
        ...this.cachedBrowserInfo,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      };
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return this.getSSRBrowserInfo();
    }

    this.cachedBrowserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform ?? 'unknown',
      vendor: navigator.vendor ?? 'unknown',
      cookieEnabled: navigator.cookieEnabled,
      online: navigator.onLine,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memory: this.getMemoryInfo(),
      connection: this.getConnectionInfo(),
    };

    return { ...this.cachedBrowserInfo };
  }

  private getCurrentUrl(): string {
    try {
      return typeof window !== 'undefined' ? window.location.href : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getMemoryInfo(): MemoryInfo | undefined {
    try {
      const perf = performance as unknown as { memory?: MemoryInfo };
      if (perf.memory) {
        return {
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          usedJSHeapSize: perf.memory.usedJSHeapSize,
        };
      }
    } catch {
      // Not available
    }
    return undefined;
  }

  private getConnectionInfo(): ConnectionInfo | undefined {
    try {
      const nav = navigator as unknown as { connection?: ConnectionInfo };
      if (nav.connection) {
        return {
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink,
          rtt: nav.connection.rtt,
          saveData: nav.connection.saveData,
        };
      }
    } catch {
      // Not available
    }
    return undefined;
  }

  private getSSRBrowserInfo(): BrowserInfo {
    return {
      userAgent: 'ssr',
      language: 'en',
      platform: 'server',
      vendor: 'unknown',
      cookieEnabled: false,
      online: true,
      screenResolution: '0x0',
      viewportSize: '0x0',
      devicePixelRatio: 1,
      colorDepth: 0,
      timezone: 'UTC',
    };
  }
}
