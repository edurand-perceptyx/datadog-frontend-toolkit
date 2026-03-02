import type { NotificationChannel } from '../../types/config';

/**
 * Monitor templates for Datadog API provisioning.
 * Creates essential frontend monitors for error rates, performance, and availability.
 */

/**
 * Traffic load size tiers — determines monitor thresholds.
 *
 * - **low**:       Internal tools, admin panels, staging — ~1-50 users/min
 * - **medium**:    B2B SaaS, department apps — ~50-500 users/min
 * - **high**:      Company-wide apps, B2C products — ~500-5,000 users/min
 * - **very-high**: High-traffic consumer apps — 5,000+ users/min
 */
export type LoadSize = 'low' | 'medium' | 'high' | 'very-high';

export const LOAD_SIZE_LABELS: Record<LoadSize, string> = {
  low: 'Low  (1–50 users/min)  — internal tools, admin panels, staging envs',
  medium: 'Medium  (50–500 users/min)  — B2B SaaS, department-level apps',
  high: 'High  (500–5,000 users/min)  — company-wide apps, B2C products',
  'very-high': 'Very High  (5,000+ users/min)  — high-traffic consumer apps',
};

interface MonitorThresholds {
  errorRate: { critical: number; warning: number; window: string };
  jsSpike: { critical: number; warning: number; window: string };
  logAnomaly: { critical: number; warning: number; window: string };
  failedApiCalls: { critical: number; warning: number; window: string };
  backend404: { critical: number; warning: number; window: string };
  lcpWindow: string;
  clsWindow: string;
  pageLoadWindow: string;
}

export const THRESHOLDS_BY_LOAD: Record<LoadSize, MonitorThresholds> = {
  low: {
    errorRate: { critical: 10, warning: 5, window: '15m' },
    jsSpike: { critical: 25, warning: 10, window: '15m' },
    logAnomaly: { critical: 50, warning: 25, window: '15m' },
    failedApiCalls: { critical: 15, warning: 5, window: '15m' },
    backend404: { critical: 20, warning: 10, window: '15m' },
    lcpWindow: '4h',
    clsWindow: '4h',
    pageLoadWindow: '4h',
  },
  medium: {
    errorRate: { critical: 50, warning: 25, window: '10m' },
    jsSpike: { critical: 100, warning: 50, window: '10m' },
    logAnomaly: { critical: 200, warning: 100, window: '15m' },
    failedApiCalls: { critical: 75, warning: 30, window: '10m' },
    backend404: { critical: 50, warning: 25, window: '10m' },
    lcpWindow: '1h',
    clsWindow: '1h',
    pageLoadWindow: '1h',
  },
  high: {
    errorRate: { critical: 200, warning: 100, window: '5m' },
    jsSpike: { critical: 500, warning: 200, window: '5m' },
    logAnomaly: { critical: 500, warning: 250, window: '10m' },
    failedApiCalls: { critical: 300, warning: 150, window: '5m' },
    backend404: { critical: 150, warning: 75, window: '5m' },
    lcpWindow: '30m',
    clsWindow: '30m',
    pageLoadWindow: '30m',
  },
  'very-high': {
    errorRate: { critical: 500, warning: 250, window: '5m' },
    jsSpike: { critical: 1000, warning: 500, window: '5m' },
    logAnomaly: { critical: 2000, warning: 1000, window: '10m' },
    failedApiCalls: { critical: 750, warning: 350, window: '5m' },
    backend404: { critical: 500, warning: 250, window: '5m' },
    lcpWindow: '15m',
    clsWindow: '15m',
    pageLoadWindow: '15m',
  },
};

function buildNotificationString(channels: NotificationChannel[]): string {
  return channels
    .map((ch) => {
      // If the target already looks like a full Datadog @-mention, use it as-is
      if (ch.target.startsWith('@')) return ch.target;
      switch (ch.type) {
        case 'email':
        case 'slack':
          // Slack email integrations (user@team.slack.com) use same syntax as email
          return `@${ch.target}`;
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
  loadSize: LoadSize = 'low',
): MonitorTemplate[] {
  const tags = [
    `env:${resolveEnvTag(env)}`,
    'source:terraform',
    'managed:datadog-frontend-toolkit',
    ...(team ? [`team:${team}`] : []),
  ];
  const notify = channels.length > 0 ? `\n\nNotify: ${buildNotificationString(channels)}` : '';
  const t = THRESHOLDS_BY_LOAD[loadSize];

  // URL-encoded query fragments for deep links
  const svcEnc = encodeURIComponent(`service:${service}`);
  const envEnc = encodeURIComponent(`env:${env}`);
  const baseQuery = `${svcEnc}%20${envEnc}`;

  // Common deep links used across monitors
  const links = {
    rumErrors: `https://app.datadoghq.com/rum/explorer?query=${baseQuery}%20%40type%3Aerror`,
    rumViews: `https://app.datadoghq.com/rum/explorer?query=${baseQuery}%20%40type%3Aview`,
    rumErrorTracking: `https://app.datadoghq.com/rum/error-tracking?query=${baseQuery}`,
    rumPerformance: `https://app.datadoghq.com/rum/performance-monitoring?query=${baseQuery}`,
    logErrors: `https://app.datadoghq.com/logs?query=${baseQuery}%20status%3Aerror`,
    logPatterns: `https://app.datadoghq.com/logs/patterns?query=${baseQuery}%20status%3Aerror`,
    rumResources: `https://app.datadoghq.com/rum/explorer?query=${baseQuery}%20%40type%3Aresource%20%40resource.status_code%3A%3E%3D400`,
    rumResources404: `https://app.datadoghq.com/rum/explorer?query=${baseQuery}%20%40type%3Aresource%20%40resource.status_code%3A404`,
    log404: `https://app.datadoghq.com/logs?query=${baseQuery}%20%40http.status_code%3A404`,
    events: `https://app.datadoghq.com/event/explorer?query=${svcEnc}`,
    bitsAi: `https://app.datadoghq.com/bits-ai/monitors/supported`,
  };

  return [
    // High Error Rate Monitor
    {
      name: `${service} (${env}) - High Frontend Error Rate`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:error").rollup("count").last("${t.errorRate.window}") > ${t.errorRate.critical}`,
      message: `## High Frontend Error Rate\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} errors (threshold: {{threshold}})\n\nThe frontend error rate has exceeded the threshold of ${t.errorRate.critical} errors in ${t.errorRate.window}.\n\n### Common Causes\n- **Failed API calls** — backend returning 4xx/5xx responses that the frontend doesn't handle gracefully\n- **Broken deployment** — a recent release introduced a regression (check recent deploys)\n- **Third-party script failure** — analytics, ads, or chat widgets throwing uncaught errors\n- **Network issues** — users on unstable connections causing fetch/XHR failures\n- **Missing resources** — 404s on assets (JS, CSS, images) after a deployment or CDN purge\n\nPlease investigate the error source in the [RUM Error Tracking](https://app.datadoghq.com/rum/error-tracking?query=service%3A${service}%20env%3A${env}).

### 📋 Recommended Actions
1. **Check recent deployments** — open [Event Explorer](${links.events}) and look for deploys in the last 30 min. If a deploy correlates, consider a rollback.
2. **Identify the top errors** — open [RUM Error Tracking](${links.rumErrorTracking}) and sort by count. Focus on the error with the highest volume.
3. **Read the stack trace** — click the top error to see the full stack trace, affected pages, and browser breakdown.
4. **Check if it's backend-related** — open [Log Explorer](${links.logErrors}) and look for 4xx/5xx responses at the same timeframe.
5. **Check third-party scripts** — if the error originates from an external domain, check if a third-party SDK (analytics, chat, ads) is failing.
6. **Reproduce locally** — use the error details (URL, browser, user action) to reproduce in a local/staging environment.
7. **Fix and verify** — deploy the fix and monitor this alert for recovery.

### 🔍 Investigate
- [RUM Error Tracking](${links.rumErrorTracking}) — grouped errors with stack traces
- [RUM Explorer (errors)](${links.rumErrors}) — raw error events with full context
- [Log Explorer (errors)](${links.logErrors}) — correlated backend error logs
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
      tags,
      options: {
        thresholds: { critical: t.errorRate.critical, warning: t.errorRate.warning },
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
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.largest_contentful_paint").last("${t.lcpWindow}") > 3000000000`,
      message: `## Poor LCP Performance\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} (threshold: {{threshold}})\n\nThe average Largest Contentful Paint has exceeded 3 seconds.\n\n### Common Causes\n- **Slow server response time (TTFB)** — backend or CDN taking too long to deliver the initial HTML\n- **Render-blocking resources** — large CSS/JS bundles that delay rendering\n- **Unoptimized images** — the largest visible element (hero image, banner) is too heavy or not lazy-loaded\n- **Web font loading** — custom fonts blocking text rendering until downloaded\n- **Client-side rendering** — heavy JS frameworks that delay meaningful paint until hydration completes\n- **Slow API calls** — if the largest element depends on data fetched after page load\n\nThis directly impacts user experience and Core Web Vitals scores.

### 📋 Recommended Actions
1. **Identify the slowest pages** — open [RUM Performance](${links.rumPerformance}) and sort views by LCP. Note which pages are above 3s.
2. **Check TTFB** — if Time to First Byte is high, the bottleneck is server-side. Check backend health and CDN config.
3. **Analyze the LCP element** — open [RUM Explorer](${links.rumViews}), click a slow view, and check which element is the LCP (usually a hero image or heading).
4. **Optimize images** — if the LCP element is an image, ensure it uses modern formats (WebP/AVIF), proper sizing, and \`loading="eager"\` for above-the-fold.
5. **Check render-blocking resources** — review the waterfall for large CSS/JS that blocks rendering. Consider code splitting or \`async\`/\`defer\` attributes.
6. **Check for recent deploys** — open [Event Explorer](${links.events}) to see if a deploy correlates with the degradation.
7. **Test with Lighthouse** — run a Lighthouse audit on the affected pages to get specific optimization suggestions.

### 🔍 Investigate
- [RUM Performance](${links.rumPerformance}) — LCP breakdown by page and resource
- [RUM Explorer (views)](${links.rumViews}) — individual view events with timing waterfall
- [Log Explorer (errors)](${links.logErrors}) — backend errors that may affect TTFB
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
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
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.cumulative_layout_shift").last("${t.clsWindow}") > 0.2`,
      message: `## High Cumulative Layout Shift\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} (threshold: {{threshold}})\n\nThe average CLS has exceeded 0.2.\n\n### Common Causes\n- **Images/videos without dimensions** — missing \`width\`/\`height\` or \`aspect-ratio\` causes content to shift when media loads\n- **Dynamically injected content** — banners, alerts, or toasts inserted above visible content push everything down\n- **Web fonts (FOUT/FOIT)** — text resizes when a custom font replaces the fallback font\n- **Late-loading components** — async data that inserts UI elements (tables, lists, cards) after the initial render\n- **Ads or third-party embeds** — iframes that resize after loading\n- **CSS animations** — transitions that change element size or position affecting layout flow\n\nLayout shifts are causing a poor user experience.

### 📋 Recommended Actions
1. **Identify the worst pages** — open [RUM Performance](${links.rumPerformance}) and sort by CLS to find the most affected pages.
2. **Find the shifting elements** — open Chrome DevTools → Performance panel → check "Layout Shift Regions" to visually see which elements move.
3. **Add explicit dimensions** — ensure all \`<img>\`, \`<video>\`, and \`<iframe>\` tags have \`width\` and \`height\` attributes or CSS \`aspect-ratio\`.
4. **Reserve space for dynamic content** — use \`min-height\` or skeleton placeholders for content loaded asynchronously (ads, banners, lazy components).
5. **Audit web fonts** — add \`font-display: swap\` and preload critical fonts with \`<link rel="preload">\`.
6. **Check for injected elements** — look for banners, toast notifications, or cookie consent bars that push content down after load.
7. **Check recent deploys** — open [Event Explorer](${links.events}) to see if a CSS or layout change correlates.

### 🔍 Investigate
- [RUM Performance](${links.rumPerformance}) — CLS breakdown by page
- [RUM Explorer (views)](${links.rumViews}) — individual view events with CLS details
- [Event Explorer](${links.events}) — recent deploys or content changes
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
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
      query: `rum("service:${service} env:${env} @type:error @error.source:source").rollup("count").last("${t.jsSpike.window}") > ${t.jsSpike.critical}`,
      message: `## JavaScript Error Spike\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} errors (threshold: {{threshold}})\n\nA spike in JavaScript errors has been detected (>${t.jsSpike.critical} in ${t.jsSpike.window}).\n\n### Common Causes\n- **Bad deployment** — a new release introduced a bug (check the latest deploy timestamp)\n- **Third-party script failure** — an external SDK (analytics, chat, payments) broke or is unreachable\n- **API contract change** — backend response shape changed and frontend code throws on unexpected data\n- **Browser compatibility** — new code uses an API not supported in older browsers\n- **CSP violations** — Content Security Policy blocking inline scripts or external resources\n- **Null/undefined references** — missing data guards in component rendering\n\nThis may indicate a deployment issue or third-party script failure.

### 📋 Recommended Actions
1. **Correlate with deployments** — open [Event Explorer](${links.events}). If a deploy happened within the last 15 min, it's likely the cause. Consider an immediate rollback.
2. **Identify the top JS error** — open [RUM Error Tracking](${links.rumErrorTracking}) and check the error with the biggest spike. Read the stack trace.
3. **Check browser breakdown** — in the error detail, check if it only affects specific browsers/versions (compatibility issue).
4. **Check third-party scripts** — if the stack trace points to an external domain, a third-party SDK may be broken. Check their status page.
5. **Check API responses** — open [Log Explorer](${links.logErrors}) and look for 4xx/5xx responses that could cause the frontend to throw.
6. **Check CSP violations** — look in browser console or CSP report endpoints for blocked scripts.
7. **Fix, test, deploy** — fix the root cause, verify in staging, and deploy. Monitor this alert for recovery.

### 🔍 Investigate
- [RUM Error Tracking](${links.rumErrorTracking}) — grouped JS errors with stack traces
- [RUM Explorer (errors)](${links.rumErrors}) — raw error events with browser/version context
- [Log Explorer (errors)](${links.logErrors}) — correlated backend error logs
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
      tags,
      options: {
        thresholds: { critical: t.jsSpike.critical, warning: t.jsSpike.warning },
        notify_no_data: false,
        renotify_interval: 15,
        include_tags: true,
      },
    },

    // Log Error Anomaly
    {
      name: `${service} (${env}) - Error Log Anomaly`,
      type: 'log alert',
      query: `logs("service:${service} env:${env} status:error").index("*").rollup("count").last("${t.logAnomaly.window}") > ${t.logAnomaly.critical}`,
      message: `## Error Log Anomaly\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} error logs (threshold: {{threshold}})\n\nAn unusual number of error logs have been detected.\n\n### Common Causes\n- **Upstream service failure** — a backend dependency is down or returning errors\n- **Configuration change** — environment variables, feature flags, or config files changed incorrectly\n- **Database issues** — connection pool exhaustion, query timeouts, or migration failures\n- **Infrastructure problems** — container restarts, memory pressure, or disk space exhaustion\n- **Authentication/authorization failures** — expired tokens, revoked keys, or permission changes\n- **Rate limiting** — hitting API rate limits from third-party services\n\nCheck [Log Explorer](https://app.datadoghq.com/logs?query=service%3A${service}%20env%3A${env}%20status%3Aerror) for details.

### 📋 Recommended Actions
1. **Check log patterns** — open [Log Patterns](${links.logPatterns}) to quickly identify the most frequent error messages. Focus on the new or growing patterns.
2. **Read the top error logs** — open [Log Explorer](${links.logErrors}), sort by time, and read the most recent error messages and stack traces.
3. **Correlate with deploys/changes** — open [Event Explorer](${links.events}) to check if a deploy, config change, or infrastructure event happened recently.
4. **Check upstream services** — if the logs reference external API calls or database queries, verify those dependencies are healthy.
5. **Check frontend impact** — open [RUM Explorer](${links.rumErrors}) to see if the backend errors are causing visible frontend errors for users.
6. **Check for resource exhaustion** — look for patterns like connection pool exhaustion, memory pressure, or disk space in the log messages.
7. **Use Bits AI SRE** — this monitor type is supported by [Bits AI SRE](${links.bitsAi}). Click "Investigate with Bits AI SRE" on the monitor page for automated root cause analysis.

### 🔍 Investigate
- [Log Explorer (errors)](${links.logErrors}) — error logs with full message and attributes
- [Log Patterns](${links.logPatterns}) — auto-clustered error patterns to spot trends
- [RUM Explorer (errors)](${links.rumErrors}) — correlated frontend errors
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis (✅ supported for log monitors)${notify}`,
      tags,
      options: {
        thresholds: { critical: t.logAnomaly.critical, warning: t.logAnomaly.warning },
        notify_no_data: false,
        renotify_interval: 30,
        include_tags: true,
      },
    },

    // Failed API Calls Monitor (RUM)
    {
      name: `${service} (${env}) - Failed API Calls (4xx/5xx)`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400").rollup("count").last("${t.failedApiCalls.window}") > ${t.failedApiCalls.critical}`,
      message: `## Failed API Calls (4xx/5xx)\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} failed calls (threshold: {{threshold}})\n\nThe number of failed API calls (HTTP 4xx/5xx from XHR/fetch) has exceeded ${t.failedApiCalls.critical} in ${t.failedApiCalls.window}.\n\n### Common Causes\n- **Backend deployment regression** — a new backend release returning unexpected errors\n- **Expired or invalid auth tokens** — 401/403 responses from session/token issues\n- **Removed or renamed endpoints** — 404s from API contract changes not reflected in the frontend\n- **Rate limiting** — 429 responses from hitting API or third-party rate limits\n- **Server overload** — 500/502/503 from backend capacity issues\n- **Network/infrastructure issues** — DNS, CDN, or load balancer misconfigurations\n
### 📋 Recommended Actions
1. **Check the status code breakdown** — open [RUM Resources](${links.rumResources}) and group by \`@resource.status_code\` to understand if it's mostly 4xx or 5xx.
2. **Identify the failing endpoints** — in [RUM Resources](${links.rumResources}), group by \`@resource.url\` to see which API endpoints are failing.
3. **Correlate with backend logs** — open [Log Explorer](${links.logErrors}) and look for the same endpoints returning errors.
4. **Check for recent deploys** — open [Event Explorer](${links.events}) for backend or frontend deployments that correlate.
5. **Check auth flows** — if 401/403 are dominant, investigate session expiry, token refresh, or permission changes.
6. **Check for rate limiting** — if 429 is present, review API quotas and implement backoff/retry strategies.
7. **Verify endpoint contracts** — if 404 is dominant, check if the backend removed or renamed endpoints.

### 🔍 Investigate
- [RUM Resources (4xx/5xx)](${links.rumResources}) — failed API calls with URL, status code, and timing
- [Log Explorer (errors)](${links.logErrors}) — correlated backend error logs
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
      tags,
      options: {
        thresholds: { critical: t.failedApiCalls.critical, warning: t.failedApiCalls.warning },
        notify_no_data: false,
        renotify_interval: 30,
        include_tags: true,
      },
    },

    // Repeated 404 on API Endpoints (RUM)
    {
      name: `${service} (${env}) - Repeated 404 on API Endpoints`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:resource @resource.type:(xhr OR fetch) @resource.status_code:404").rollup("count").last("${t.backend404.window}") > ${t.backend404.critical}`,
      message: `## Repeated 404 on API Endpoints\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} 404 responses (threshold: {{threshold}})\n\nAPI endpoints are returning HTTP 404 (Not Found) repeatedly — ${t.backend404.critical}+ hits in ${t.backend404.window}.\n\n### Common Causes\n- **Removed or renamed API routes** — a backend deployment removed or changed a URL that the frontend still calls\n- **Misconfigured routing** — reverse proxy, load balancer, or API gateway routing rules changed\n- **Feature flag mismatch** — frontend expects an endpoint that's behind a feature flag not enabled in this environment\n- **CDN/cache purge** — assets or API responses cached at a URL that no longer exists\n- **Database-driven routes** — dynamic routes that depend on deleted or unpublished records\n\n### 📋 Recommended Actions
1. **Identify which endpoints are 404ing** — open [RUM Resources (404)](${links.rumResources404}) and group by \`@resource.url\` to see the most affected endpoints.
2. **Check affected users** — in the RUM Explorer, check which views/sessions are hitting the 404 endpoints.
3. **Correlate with deploys** — open [Event Explorer](${links.events}) and check if a recent backend deploy removed or renamed the endpoint.
4. **Check routing config** — verify API gateway, reverse proxy, or load balancer rules haven't changed.
5. **Verify feature flags** — ensure the endpoint isn't gated behind a flag that's disabled in this environment.
6. **Check backend logs** — open [Log Explorer](${links.logErrors}) to see if the backend is logging the 404 responses with additional context.
7. **Fix the mismatch** — either restore the endpoint, add a redirect, or update the frontend to use the new URL.

### 🔍 Investigate
- [RUM Resources (404)](${links.rumResources404}) — 404 API calls with URL, timing, and user context
- [RUM Resources (all errors)](${links.rumResources}) — all failed API calls for broader context
- [Log Explorer (errors)](${links.logErrors}) — correlated backend error logs
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
      tags,
      options: {
        thresholds: { critical: t.backend404.critical, warning: t.backend404.warning },
        notify_no_data: false,
        renotify_interval: 30,
        include_tags: true,
      },
    },

    // Slow Page Load Monitor
    {
      name: `${service} (${env}) - Slow Page Load`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.loading_time").last("${t.pageLoadWindow}") > 5000000000`,
      message: `## Slow Page Load Time\n\n**Monitor:** {{monitor_name}}\n**Service:** ${service}\n**Environment:** ${env}\n**Load Profile:** ${loadSize}\n**Triggered Value:** {{value}} (threshold: {{threshold}})\n\nThe average page loading time has exceeded 5 seconds.\n\n### Common Causes\n- **Slow API responses** — backend endpoints taking too long, blocking the view from being considered loaded\n- **Heavy JavaScript bundles** — large unoptimized bundles delaying parsing and execution\n- **Excessive API calls on mount** — too many parallel or sequential requests during component initialization\n- **Unoptimized database queries** — N+1 queries or missing indexes on the backend\n- **Missing code splitting** — loading the entire app bundle instead of lazy-loading routes\n- **Large DOM size** — rendering thousands of elements (e.g., long lists without virtualization)\n\nThis impacts user experience and may indicate backend latency or heavy frontend rendering.

### 📋 Recommended Actions
1. **Identify the slowest pages** — open [RUM Performance](${links.rumPerformance}) and sort by loading time to find the worst offenders.
2. **Analyze the waterfall** — open [RUM Explorer](${links.rumViews}), click a slow view, and check the timing waterfall. Look for long network requests or JS execution.
3. **Check backend latency** — open [Log Explorer](${links.logErrors}) and look for slow API responses (high response times or timeouts).
4. **Audit bundle size** — check if the JS bundle has grown recently. Use \`webpack-bundle-analyzer\` or similar tools to find heavy dependencies.
5. **Check code splitting** — ensure routes are lazy-loaded. Large monolithic bundles severely impact load times.
6. **Check for N+1 API calls** — look at the network tab for pages making excessive parallel or sequential API calls on mount.
7. **Check recent deploys** — open [Event Explorer](${links.events}) to correlate slow load times with recent code or infrastructure changes.
8. **Profile in DevTools** — open Chrome DevTools → Performance tab → record a page load to identify long tasks and rendering bottlenecks.

### 🔍 Investigate
- [RUM Performance](${links.rumPerformance}) — loading time breakdown by page
- [RUM Explorer (views)](${links.rumViews}) — individual view events with timing waterfall
- [Log Explorer (errors)](${links.logErrors}) — backend errors that may cause slow responses
- [Event Explorer](${links.events}) — recent deploys, config changes, and incidents
- [Bits AI SRE](${links.bitsAi}) — AI-powered root cause analysis${notify}`,
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
