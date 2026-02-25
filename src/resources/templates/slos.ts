/**
 * SLO templates for Datadog API provisioning.
 * Follows Google SRE and industry best-practices for frontend observability.
 *
 * Uses only built-in RUM metrics so historical data is available immediately.
 *
 * SLO 1 — Frontend Availability (metric-based, event SLO)
 *   good = error-free views, total = all views
 *   Pattern mirrors the classic (total − errors) / total used for backend APIs.
 *   Targets are environment-aware (production vs non-production).
 *
 * SLO 2 — Core Web Vitals / LCP (time-slice SLO)
 *   Measures % of 5-min windows where p75 LCP < 2.5 s (Google "good" threshold).
 *   Uses the existing rum.measure.view.largest_contentful_paint distribution metric.
 */

export interface SloTemplate {
  name: string;
  description: string;
  type: 'metric' | 'time_slice';
  query?: {
    numerator: string;
    denominator: string;
  };
  sli_specification?: Record<string, unknown>;
  thresholds: Array<{ timeframe: string; target: number; warning?: number }>;
  tags: string[];
}

/**
 * Burn-rate alert definitions created after SLOs are provisioned.
 * Based on the Google SRE multi-window, multi-burn-rate approach.
 */
export interface BurnRateAlertTemplate {
  nameSuffix: string;
  long_window: string;
  short_window: string;
  critical: number;
  warning: number;
  message: string;
}

/** Standard multi-window burn-rate alerts (Google SRE playbook). */
export const BURN_RATE_ALERTS: BurnRateAlertTemplate[] = [
  {
    nameSuffix: 'High Burn Rate',
    long_window: '1h',
    short_window: '5m',
    critical: 14.4,
    warning: 7.2,
    message:
      '## 🔥 SLO High Burn Rate\n\nThe error budget is being consumed **14× faster** than sustainable. At this rate the entire 30-day budget will be exhausted in ~2 days.\n\n**Action required:** Investigate immediately — this usually signals a deployment regression or upstream outage.',
  },
  {
    nameSuffix: 'Slow Burn Rate',
    long_window: '6h',
    short_window: '30m',
    critical: 6,
    warning: 3,
    message:
      '## ⚠️ SLO Slow Burn Rate\n\nThe error budget is being consumed **6× faster** than sustainable. At this rate the entire 30-day budget will be exhausted in ~5 days.\n\n**Action required:** Create a ticket and investigate within 24 hours — this usually signals a gradual degradation.',
  },
];

const PRODUCTION_ENVS = ['production', 'prod', 'prd'];

function isProduction(env: string): boolean {
  return PRODUCTION_ENVS.includes(env.toLowerCase());
}

export function buildSloTemplates(
  service: string,
  env: string,
  _monitorIds: { id: number; name: string }[],
  team?: string,
): SloTemplate[] {
  const tags = [
    `service:${service}`,
    `env:${env}`,
    'managed:datadog-frontend-toolkit',
    ...(team ? [`team:${team}`] : []),
  ];

  // Environment-aware targets (Google SRE best practice: start realistic, tighten over time)
  const isProd = isProduction(env);
  const availabilityTarget = isProd ? 99.5 : 95;
  const availabilityWarning = isProd ? 99.9 : 98;

  return [
    // SLO 1: Frontend Availability — error-free page views / total page views
    {
      name: `${service} (${env}) - Frontend Availability`,
      description:
        `Measures frontend availability as the ratio of error-free page views to total page views. ` +
        `Target: ${availabilityTarget}% (${isProd ? 'production' : 'non-production'}). ` +
        `A negative error budget indicates the service has more JS errors than the target allows — ` +
        `this is a real signal, not a bug. Managed by datadog-frontend-toolkit.`,
      type: 'metric',
      query: {
        numerator: `sum:rum.measure.view.error_free{service:${service},env:${env}}.as_count()`,
        denominator: `sum:rum.measure.view{service:${service},env:${env}}.as_count()`,
      },
      thresholds: [
        { timeframe: '7d', target: availabilityTarget, warning: availabilityWarning },
        { timeframe: '30d', target: availabilityTarget, warning: availabilityWarning },
      ],
      tags,
    },
    // SLO 2: Core Web Vitals (LCP) — % of 5-min windows with p75 LCP < 2.5 s
    {
      name: `${service} (${env}) - Core Web Vitals (LCP)`,
      description:
        'Measures the percentage of time where p75 Largest Contentful Paint stays below 2.5 s ' +
        '(Google Core Web Vitals "good" threshold). Managed by datadog-frontend-toolkit.',
      type: 'time_slice',
      sli_specification: {
        time_slice: {
          query: {
            formulas: [{ formula: 'query1' }],
            queries: [
              {
                data_source: 'metrics',
                name: 'query1',
                query: `p75:rum.measure.view.largest_contentful_paint{service:${service},env:${env}}`,
              },
            ],
          },
          comparator: '<',
          threshold: 2500000000,
          query_interval_seconds: 300,
        },
      },
      thresholds: [
        { timeframe: '7d', target: 75, warning: 90 },
        { timeframe: '30d', target: 75, warning: 90 },
      ],
      tags,
    },
  ];
}
