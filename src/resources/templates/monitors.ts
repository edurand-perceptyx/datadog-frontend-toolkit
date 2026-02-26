import type { NotificationChannel } from '../../types/config';

/**
 * Monitor templates for Datadog API provisioning.
 * Creates essential frontend monitors for error rates, performance, and availability.
 */

function buildNotificationString(channels: NotificationChannel[]): string {
  return channels
    .map((ch) => {
      switch (ch.type) {
        case 'email':
          return `@${ch.target}`;
        case 'slack':
          return `@slack-${ch.target}`;
        case 'pagerduty':
          return `@pagerduty-${ch.target}`;
        case 'opsgenie':
          return `@opsgenie-${ch.target}`;
        case 'webhook':
          return `@webhook-${ch.target}`;
        default:
          return `@${ch.target}`;
      }
    })
    .join(' ');
}

export interface MonitorTemplate {
  name: string;
  type: string;
  query: string;
  message: string;
  tags: string[];
  options: Record<string, unknown>;
}

const ENV_ALIASES: Record<string, string> = {
  prod: 'production',
  prd: 'production',
  stg: 'staging',
  stage: 'staging',
  dev: 'development',
  develop: 'development',
  tst: 'testing',
  qa: 'testing',
  uat: 'testing',
  sbx: 'sandbox',
  shared: 'sharedservices',
};

function resolveEnvTag(env: string): string {
  const lower = env.toLowerCase();
  return ENV_ALIASES[lower] || lower;
}

export function buildMonitorTemplates(
  service: string,
  env: string,
  channels: NotificationChannel[] = [],
  team?: string,
): MonitorTemplate[] {
  const tags = [
    `env:${resolveEnvTag(env)}`,
    'source:terraform',
    'managed:datadog-frontend-toolkit',
    ...(team ? [`team:${team}`] : []),
  ];
  const notify = channels.length > 0 ? `\n\nNotify: ${buildNotificationString(channels)}` : '';

  return [
    // High Error Rate Monitor
    {
      name: `${service} (${env}) - High Frontend Error Rate`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:error").rollup("count").last("5m") > 50`,
      message: `## High Frontend Error Rate\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe frontend error rate has exceeded the threshold of 50 errors in 5 minutes.\n\n### Common Causes\n- **Failed API calls** — backend returning 4xx/5xx responses that the frontend doesn't handle gracefully\n- **Broken deployment** — a recent release introduced a regression (check recent deploys)\n- **Third-party script failure** — analytics, ads, or chat widgets throwing uncaught errors\n- **Network issues** — users on unstable connections causing fetch/XHR failures\n- **Missing resources** — 404s on assets (JS, CSS, images) after a deployment or CDN purge\n\nPlease investigate the error source in the [RUM Error Tracking](https://app.datadoghq.com/rum/error-tracking?query=service%3A${service}%20env%3A${env}).${notify}`,
      tags,
      options: {
        thresholds: { critical: 50, warning: 25 },
        notify_no_data: false,
        renotify_interval: 30,
        escalation_message: `Error rate still elevated for ${service} (${env})`,
        include_tags: true,
      },
    },

    // Poor LCP Monitor
    {
      name: `${service} (${env}) - Poor LCP Performance`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.largest_contentful_paint").last("4h") > 3000000000`,
      message: `## Poor LCP Performance\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average Largest Contentful Paint has exceeded 3 seconds.\n\n### Common Causes\n- **Slow server response time (TTFB)** — backend or CDN taking too long to deliver the initial HTML\n- **Render-blocking resources** — large CSS/JS bundles that delay rendering\n- **Unoptimized images** — the largest visible element (hero image, banner) is too heavy or not lazy-loaded\n- **Web font loading** — custom fonts blocking text rendering until downloaded\n- **Client-side rendering** — heavy JS frameworks that delay meaningful paint until hydration completes\n- **Slow API calls** — if the largest element depends on data fetched after page load\n\nThis directly impacts user experience and Core Web Vitals scores.${notify}`,
      tags,
      options: {
        thresholds: { critical: 3000000000, warning: 2000000000 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },

    // High CLS Monitor
    {
      name: `${service} (${env}) - High CLS Score`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.cumulative_layout_shift").last("4h") > 0.2`,
      message: `## High Cumulative Layout Shift\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average CLS has exceeded 0.2.\n\n### Common Causes\n- **Images/videos without dimensions** — missing \`width\`/\`height\` or \`aspect-ratio\` causes content to shift when media loads\n- **Dynamically injected content** — banners, alerts, or toasts inserted above visible content push everything down\n- **Web fonts (FOUT/FOIT)** — text resizes when a custom font replaces the fallback font\n- **Late-loading components** — async data that inserts UI elements (tables, lists, cards) after the initial render\n- **Ads or third-party embeds** — iframes that resize after loading\n- **CSS animations** — transitions that change element size or position affecting layout flow\n\nLayout shifts are causing a poor user experience.${notify}`,
      tags,
      options: {
        thresholds: { critical: 0.2, warning: 0.1 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },

    // JavaScript Error Spike
    {
      name: `${service} (${env}) - JS Error Spike`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:error @error.source:source").rollup("count").last("5m") > 100`,
      message: `## JavaScript Error Spike\n\n**Service:** ${service}\n**Environment:** ${env}\n\nA spike in JavaScript errors has been detected (>100 in 5 minutes).\n\n### Common Causes\n- **Bad deployment** — a new release introduced a bug (check the latest deploy timestamp)\n- **Third-party script failure** — an external SDK (analytics, chat, payments) broke or is unreachable\n- **API contract change** — backend response shape changed and frontend code throws on unexpected data\n- **Browser compatibility** — new code uses an API not supported in older browsers\n- **CSP violations** — Content Security Policy blocking inline scripts or external resources\n- **Null/undefined references** — missing data guards in component rendering\n\nThis may indicate a deployment issue or third-party script failure.${notify}`,
      tags,
      options: {
        thresholds: { critical: 100, warning: 50 },
        notify_no_data: false,
        renotify_interval: 15,
        include_tags: true,
      },
    },

    // Log Error Anomaly
    {
      name: `${service} (${env}) - Error Log Anomaly`,
      type: 'log alert',
      query: `logs("service:${service} env:${env} status:error").index("*").rollup("count").last("15m") > 200`,
      message: `## Error Log Anomaly\n\n**Service:** ${service}\n**Environment:** ${env}\n\nAn unusual number of error logs have been detected.\n\n### Common Causes\n- **Upstream service failure** — a backend dependency is down or returning errors\n- **Configuration change** — environment variables, feature flags, or config files changed incorrectly\n- **Database issues** — connection pool exhaustion, query timeouts, or migration failures\n- **Infrastructure problems** — container restarts, memory pressure, or disk space exhaustion\n- **Authentication/authorization failures** — expired tokens, revoked keys, or permission changes\n- **Rate limiting** — hitting API rate limits from third-party services\n\nCheck [Log Explorer](https://app.datadoghq.com/logs?query=service%3A${service}%20env%3A${env}%20status%3Aerror) for details.${notify}`,
      tags,
      options: {
        thresholds: { critical: 200, warning: 100 },
        notify_no_data: false,
        renotify_interval: 30,
        include_tags: true,
      },
    },

    // Slow Page Load Monitor
    {
      name: `${service} (${env}) - Slow Page Load`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.loading_time").last("4h") > 5000000000`,
      message: `## Slow Page Load Time\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average page loading time has exceeded 5 seconds.\n\n### Common Causes\n- **Slow API responses** — backend endpoints taking too long, blocking the view from being considered loaded\n- **Heavy JavaScript bundles** — large unoptimized bundles delaying parsing and execution\n- **Excessive API calls on mount** — too many parallel or sequential requests during component initialization\n- **Unoptimized database queries** — N+1 queries or missing indexes on the backend\n- **Missing code splitting** — loading the entire app bundle instead of lazy-loading routes\n- **Large DOM size** — rendering thousands of elements (e.g., long lists without virtualization)\n\nThis impacts user experience and may indicate backend latency or heavy frontend rendering.${notify}`,
      tags,
      options: {
        thresholds: { critical: 5000000000, warning: 3000000000 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },
  ];
}
