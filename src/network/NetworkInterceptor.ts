import type { ResolvedConfig } from '../types/config';
import type { LoggerService } from '../logger/LoggerService';
import type { EventEmitter } from '../utils/EventEmitter';
import { SDKEvent } from '../types/events';
import type { NetworkRequestPayload } from '../types/events';

/**
 * Intercepts XHR and Fetch requests to track network performance,
 * detect failures, and enrich Datadog context with API call data.
 *
 * Uses the Proxy/Decorator pattern to wrap native browser APIs
 * without breaking existing functionality.
 */
export class NetworkInterceptor {
  private readonly config: ResolvedConfig;
  private readonly logger: LoggerService;
  private readonly emitter: EventEmitter;
  private installed = false;

  private originalFetch: typeof fetch | undefined;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | undefined;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | undefined;

  constructor(config: ResolvedConfig, logger: LoggerService, emitter: EventEmitter) {
    this.config = config;
    this.logger = logger;
    this.emitter = emitter;
  }

  /**
   * Installs network interceptors for Fetch and XHR.
   */
  install(): void {
    if (this.installed || typeof window === 'undefined') {
      return;
    }

    this.interceptFetch();
    this.interceptXhr();
    this.installed = true;
  }

  /**
   * Restores original Fetch and XHR implementations.
   */
  uninstall(): void {
    if (!this.installed || typeof window === 'undefined') {
      return;
    }

    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }

    if (this.originalXhrOpen && this.originalXhrSend) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      XMLHttpRequest.prototype.send = this.originalXhrSend;
    }

    this.installed = false;
  }

  private interceptFetch(): void {
    if (typeof fetch === 'undefined') return;

    this.originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = self.extractUrl(input);
      const method = init?.method || 'GET';

      if (self.shouldExclude(url)) {
        return self.originalFetch!(input, init);
      }

      const startTime = performance.now();

      try {
        const response = await self.originalFetch!(input, init);
        const duration = performance.now() - startTime;

        self.reportRequest({
          method: method.toUpperCase(),
          url,
          status: response.status,
          duration,
          responseSize: self.getContentLength(response.headers),
        });

        if (!response.ok) {
          self.logger.warn(`HTTP ${response.status} ${method.toUpperCase()} ${url}`, {
            status: response.status,
            statusText: response.statusText,
            duration_ms: Math.round(duration),
            url,
            method: method.toUpperCase(),
          });
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;

        self.reportRequest({
          method: method.toUpperCase(),
          url,
          status: 0,
          duration,
          error: error instanceof Error ? error.message : 'Network error',
        });

        self.logger.error(`Network error: ${method.toUpperCase()} ${url}`, error instanceof Error ? error : new Error(String(error)), {
          duration_ms: Math.round(duration),
          url,
          method: method.toUpperCase(),
        });

        throw error;
      }
    };
  }

  private interceptXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _ddMethod?: string; _ddUrl?: string },
      method: string,
      url: string | URL,
      ...args: unknown[]
    ): void {
      this._ddMethod = method.toUpperCase();
      this._ddUrl = url.toString();
      return self.originalXhrOpen!.apply(this, [method, url, ...args] as Parameters<typeof XMLHttpRequest.prototype.open>);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _ddMethod?: string; _ddUrl?: string },
      body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
      const xhrMethod = this._ddMethod || 'UNKNOWN';
      const xhrUrl = this._ddUrl || 'unknown';

      if (self.shouldExclude(xhrUrl)) {
        return self.originalXhrSend!.call(this, body);
      }

      const startTime = performance.now();

      this.addEventListener('loadend', function () {
        const duration = performance.now() - startTime;

        self.reportRequest({
          method: xhrMethod,
          url: xhrUrl,
          status: this.status,
          duration,
        });

        if (this.status >= 400 || this.status === 0) {
          self.logger.warn(`XHR ${this.status} ${xhrMethod} ${xhrUrl}`, {
            status: this.status,
            duration_ms: Math.round(duration),
            url: xhrUrl,
            method: xhrMethod,
          });
        }
      });

      this.addEventListener('error', function () {
        const duration = performance.now() - startTime;
        self.reportRequest({
          method: xhrMethod,
          url: xhrUrl,
          status: 0,
          duration,
          error: 'XHR network error',
        });
      });

      return self.originalXhrSend!.call(this, body);
    };
  }

  private shouldExclude(url: string): boolean {
    return this.config.network.excludeUrls.some((pattern) => {
      if (typeof pattern === 'string') {
        return url.includes(pattern);
      }
      return pattern.test(url);
    });
  }

  private extractUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return 'unknown';
  }

  private getContentLength(headers: Headers): number | undefined {
    const cl = headers.get('content-length');
    return cl ? parseInt(cl, 10) : undefined;
  }

  private reportRequest(data: {
    method: string;
    url: string;
    status: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    error?: string;
  }): void {
    if (this.config.network.failedOnly && data.status > 0 && data.status < 400) {
      return;
    }

    const payload: NetworkRequestPayload = {
      type: SDKEvent.NETWORK_REQUEST,
      timestamp: Date.now(),
      data,
    };
    this.emitter.emit(SDKEvent.NETWORK_REQUEST, payload);
  }
}
