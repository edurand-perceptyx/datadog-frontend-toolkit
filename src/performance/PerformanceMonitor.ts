import type { ResolvedConfig } from '../types/config';
import type { LoggerService } from '../logger/LoggerService';
import type { RumManager } from '../rum/RumManager';
import type { EventEmitter } from '../utils/EventEmitter';
import { SDKEvent } from '../types/events';
import type { PerformanceEntryPayload } from '../types/events';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

/** Thresholds based on Google's Web Vitals recommendations */
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Monitors Web Vitals, Long Tasks, and custom performance marks.
 * Uses the PerformanceObserver API for non-intrusive monitoring.
 * Reports metrics to both Datadog RUM and the logger for visibility.
 *
 * Follows the Observer pattern to collect performance entries.
 */
export class PerformanceMonitor {
  private readonly config: ResolvedConfig;
  private readonly logger: LoggerService;
  private readonly rumManager: RumManager;
  private readonly emitter: EventEmitter;
  private observers: PerformanceObserver[] = [];
  private started = false;

  constructor(
    config: ResolvedConfig,
    logger: LoggerService,
    rumManager: RumManager,
    emitter: EventEmitter,
  ) {
    this.config = config;
    this.logger = logger;
    this.rumManager = rumManager;
    this.emitter = emitter;
  }

  /**
   * Starts all configured performance observers.
   */
  start(): void {
    if (this.started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }

    if (this.config.performance.webVitals) {
      this.observeWebVitals();
    }

    if (this.config.performance.longTasks) {
      this.observeLongTasks();
    }

    if (this.config.performance.resourceTiming) {
      this.observeResources();
    }

    this.collectNavigationTiming();

    this.started = true;
  }

  /**
   * Records a custom performance mark.
   */
  mark(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`dd_toolkit_${name}`);
    }
  }

  /**
   * Measures time between two marks.
   */
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    if (typeof performance === 'undefined') return undefined;

    try {
      const prefixedStart = `dd_toolkit_${startMark}`;
      const prefixedEnd = endMark ? `dd_toolkit_${endMark}` : undefined;

      if (prefixedEnd) {
        performance.measure(name, prefixedStart, prefixedEnd);
      } else {
        performance.measure(name, prefixedStart);
      }

      const entries = performance.getEntriesByName(name, 'measure');
      const entry = entries[entries.length - 1];

      if (entry) {
        const duration = Math.round(entry.duration);
        this.rumManager.addTiming(name, duration);
        this.logger.debug(`Performance measure: ${name}`, { duration_ms: duration });
        return duration;
      }
    } catch {
      // Mark not found or measurement failed
    }

    return undefined;
  }

  /**
   * Stops all performance observers.
   */
  stop(): void {
    for (const observer of this.observers) {
      try {
        observer.disconnect();
      } catch {
        // Observer might already be disconnected
      }
    }
    this.observers = [];
    this.started = false;
  }

  private observeWebVitals(): void {
    // Largest Contentful Paint
    if (this.config.performance.largestContentfulPaint) {
      this.safeObserve('largest-contentful-paint', (entries) => {
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.reportMetric({
            name: 'LCP',
            value: lastEntry.startTime,
            rating: this.rate(lastEntry.startTime, THRESHOLDS.LCP),
          });
        }
      });
    }

    // First Input Delay
    if (this.config.performance.firstInputDelay) {
      this.safeObserve('first-input', (entries) => {
        const entry = entries[0] as PerformanceEventTiming | undefined;
        if (entry) {
          const fid = entry.processingStart - entry.startTime;
          this.reportMetric({
            name: 'FID',
            value: fid,
            rating: this.rate(fid, THRESHOLDS.FID),
          });
        }
      });
    }

    // Cumulative Layout Shift
    if (this.config.performance.cumulativeLayoutShift) {
      let clsValue = 0;
      this.safeObserve('layout-shift', (entries) => {
        for (const entry of entries) {
          const lsEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!lsEntry.hadRecentInput && lsEntry.value) {
            clsValue += lsEntry.value;
          }
        }
        this.reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: this.rate(clsValue, THRESHOLDS.CLS),
        });
      });
    }

    // Interaction to Next Paint
    if (this.config.performance.interactionToNextPaint) {
      this.safeObserve('event', (entries) => {
        let maxDuration = 0;
        for (const entry of entries) {
          if (entry.duration > maxDuration) {
            maxDuration = entry.duration;
          }
        }
        if (maxDuration > 0) {
          this.reportMetric({
            name: 'INP',
            value: maxDuration,
            rating: this.rate(maxDuration, THRESHOLDS.INP),
          });
        }
      }, { durationThreshold: 40 });
    }

    // First Contentful Paint
    this.safeObserve('paint', (entries) => {
      const fcp = entries.find((e) => e.name === 'first-contentful-paint');
      if (fcp) {
        this.reportMetric({
          name: 'FCP',
          value: fcp.startTime,
          rating: this.rate(fcp.startTime, THRESHOLDS.FCP),
        });
      }
    });
  }

  private observeLongTasks(): void {
    this.safeObserve('longtask', (entries) => {
      for (const entry of entries) {
        if (entry.duration >= this.config.performance.longTaskThreshold) {
          this.logger.warn('Long task detected', {
            duration_ms: Math.round(entry.duration),
            name: entry.name,
            startTime: Math.round(entry.startTime),
          });
        }
      }
    });
  }

  private observeResources(): void {
    this.safeObserve('resource', (entries) => {
      for (const entry of entries) {
        const resource = entry as PerformanceResourceTiming;
        if (resource.duration > 5000) {
          this.logger.warn('Slow resource detected', {
            name: resource.name,
            duration_ms: Math.round(resource.duration),
            type: resource.initiatorType,
            size: resource.transferSize,
          });
        }
      }
    });
  }

  private collectNavigationTiming(): void {
    if (typeof window === 'undefined') return;

    // Defer to ensure navigation timing is available
    const onLoad = (): void => {
      setTimeout(() => {
        const entries = performance.getEntriesByType('navigation');
        const nav = entries[0] as PerformanceNavigationTiming | undefined;

        if (nav) {
          this.reportMetric({
            name: 'TTFB',
            value: nav.responseStart,
            rating: this.rate(nav.responseStart, THRESHOLDS.TTFB),
            navigationType: nav.type,
          });

          this.logger.debug('Navigation timing', {
            dns_ms: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcp_ms: Math.round(nav.connectEnd - nav.connectStart),
            ttfb_ms: Math.round(nav.responseStart),
            dom_interactive_ms: Math.round(nav.domInteractive),
            dom_complete_ms: Math.round(nav.domComplete),
            load_ms: Math.round(nav.loadEventEnd),
            transfer_size: nav.transferSize,
            type: nav.type,
          });
        }
      }, 0);
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }
  }

  private safeObserve(
    type: string,
    callback: (entries: PerformanceEntryList) => void,
    options?: Record<string, unknown>,
  ): void {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) {
        return;
      }

      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ type, buffered: true, ...options } as PerformanceObserverInit);
      this.observers.push(observer);
    } catch {
      // Observer type not supported in this browser
    }
  }

  private reportMetric(metric: WebVitalMetric): void {
    this.rumManager.addTiming(metric.name, Math.round(metric.value));

    const payload: PerformanceEntryPayload = {
      type: SDKEvent.PERFORMANCE_ENTRY,
      timestamp: Date.now(),
      data: metric,
    };
    this.emitter.emit(SDKEvent.PERFORMANCE_ENTRY, payload);

    if (metric.rating === 'poor') {
      this.logger.warn(`Poor ${metric.name} detected`, {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
      });
    } else {
      this.logger.debug(`Web Vital: ${metric.name}`, {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
      });
    }
  }

  private rate(
    value: number,
    thresholds: { good: number; poor: number },
  ): 'good' | 'needs-improvement' | 'poor' {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }
}

/** Type augmentation for PerformanceEventTiming */
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}
