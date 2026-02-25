# datadog-frontend-toolkit

> Enterprise-grade, framework-agnostic frontend observability toolkit for Datadog.

One `init()` call to auto-instrument **RUM**, **Logs**, **Error Tracking**, **Performance Monitoring**, and auto-provision **Dashboards**, **Monitors**, **SLOs** & **Burn Rate Alerts** in Datadog.

---

## Features

- **Zero-config observability** — single `init()` bootstraps everything
- **Framework agnostic** — works with React, Vue, Angular, Svelte, vanilla JS
- **Full TypeScript support** — complete type declarations and IntelliSense
- **Structured LoggerService** — `debug`, `info`, `warn`, `error`, `critical` with auto-forwarding to Datadog
- **Global Error Boundary** — catches unhandled errors + promise rejections automatically
- **Web Vitals tracking** — LCP, CLS, FID, INP, FCP, TTFB with threshold alerts
- **Network interception** — monitors XHR/Fetch for failures and slow requests
- **PII sanitization** — auto-redacts emails, credit cards, passwords from logs
- **Resource provisioning CLI** — auto-creates Dashboards, Monitors, SLOs, and Burn Rate Alerts
- **Environment-aware SLO targets** — 99.5% for production, 95% for non-production
- **Google SRE burn rate alerts** — multi-window, multi-burn-rate alerting with auto-clamped thresholds
- **Resource teardown** — `--remove` flag deletes all managed resources for a service/environment
- **Plugin system** — extend with custom integrations
- **Lifecycle hooks** — `beforeInit`, `afterInit`, `beforeLog`, `beforeError`
- **Child loggers** — scoped context for module-specific logging
- **Session replay** — configurable recording with privacy controls
- **Consent mode** — GDPR-friendly opt-in tracking
- **Retry with backoff** — resilient API communication
- **Throttling** — prevents log flooding during error storms

---

## Installation

```bash
npm install datadog-frontend-toolkit
```

> `@datadog/browser-rum` and `@datadog/browser-logs` are included as dependencies — no need to install them separately.

---

## Quick Start

```typescript
import { init } from 'datadog-frontend-toolkit';

const observatory = init({
  clientToken: 'pub-xxxxxxxxxxxxxxxxxxxx',
  applicationId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  service: 'my-frontend-app',
  env: 'production',
  version: '1.2.3',
});

// That's it! RUM, Logs, Error Tracking, and Performance Monitoring are now active.

// Use the logger anywhere
observatory.logger.info('Application started');
observatory.logger.error('Payment failed', new Error('timeout'), { orderId: 'abc-123' });
```

---

## API Reference

### `init(config): ObservabilitySDK`

Initializes the SDK. Call once at application bootstrap.

```typescript
import { init } from 'datadog-frontend-toolkit';

const observatory = init({
  // Required
  clientToken: 'pub-xxx',
  applicationId: 'xxx-xxx',
  service: 'my-app',
  env: 'production',

  // Optional
  version: '1.0.0',
  site: 'datadoghq.com',
  debug: false,
  logLevel: 'warn',

  // Sampling
  sampling: {
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    traceSampleRate: 100,
  },

  // Error tracking
  errorTracking: {
    enabled: true,
    unhandledRejections: true,
    consoleErrors: true,
    ignorePatterns: ['ResizeObserver loop'],
    maxErrorsPerMinute: 100,
  },

  // Performance
  performance: {
    webVitals: true,
    longTasks: true,
    resourceTiming: true,
  },

  // Network
  network: {
    enabled: true,
    excludeUrls: [/analytics/, 'hotjar.com'],
    failedOnly: false,
  },

  // Privacy
  privacy: {
    defaultPrivacyLevel: 'mask-user-input',
    piiFields: ['ssn', 'dob'],
    requireConsent: false,
  },

  // User context
  user: {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    plan: 'enterprise',
  },

  // Global context for all events
  globalContext: {
    team: 'frontend',
    region: 'us-east-1',
  },

  tags: ['team:frontend', 'product:checkout'],

  // APM correlation
  allowedTracingUrls: ['https://api.myapp.com'],

  // Lifecycle hooks
  hooks: {
    beforeLog: (level, message) => {
      // Return false to skip this log
      return !message.includes('noisy-module');
    },
    afterInit: () => {
      console.log('Observability ready!');
    },
  },
});
```

### Logger

```typescript
const logger = observatory.logger;

// Standard levels
logger.debug('Detailed info for development');
logger.info('User signed in', { userId: '123' });
logger.warn('Deprecation notice', { feature: 'old-api' });
logger.error('Request failed', new Error('500'), { endpoint: '/api/users' });
logger.critical('Database unreachable', new Error('ECONNREFUSED'));

// Timed operations
const result = await logger.time('fetchUsers', async () => {
  return await fetch('/api/users');
});

// Child loggers with scoped context
const authLogger = logger.child({ module: 'auth' });
authLogger.info('Login attempt'); // includes { module: 'auth' } in every log

// Scoped context
logger.setContext({ requestId: 'req-456' });
logger.info('Processing'); // includes requestId in context
logger.clearContext();
```

### User Context

```typescript
// Set user after login
observatory.setUser({
  id: 'user-123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  plan: 'enterprise',
});

// Clear on logout
observatory.clearUser();
```

### SPA View Tracking

```typescript
// Call on route change
observatory.setView('/dashboard');
observatory.setView('/settings/profile');
```

### Custom Actions

```typescript
observatory.trackAction('add_to_cart', {
  productId: 'prod-456',
  price: 29.99,
  currency: 'USD',
});
```

### Error Capture

```typescript
try {
  await riskyOperation();
} catch (error) {
  observatory.captureError(error, {
    operation: 'riskyOperation',
    userId: 'user-123',
  });
}

// Capture a message
observatory.captureMessage('Feature flag evaluation failed', {
  flag: 'new-checkout',
});
```

### Performance Marks

```typescript
observatory.mark('checkout-start');
// ... checkout logic ...
observatory.mark('checkout-end');
const duration = observatory.measure('checkout', 'checkout-start', 'checkout-end');
```

### Session Replay

```typescript
observatory.startSessionReplay();
observatory.stopSessionReplay();
```

### Global Context

```typescript
observatory.addGlobalContext('tenant', 'acme-corp');
observatory.removeGlobalContext('tenant');
```

### Events

```typescript
import { SDKEvent } from 'datadog-frontend-toolkit';

observatory.onEvent(SDKEvent.ERROR_CAPTURED, (payload) => {
  console.log('Error captured:', payload.data);
});

observatory.onEvent(SDKEvent.PERFORMANCE_ENTRY, (payload) => {
  console.log('Web Vital:', payload.data);
});
```

### Global Access

```typescript
// From anywhere in your app
import { getInstance, getLogger } from 'datadog-frontend-toolkit';

const sdk = getInstance(); // returns null if not initialized
const logger = getLogger(); // throws if not initialized
```

### Destroy

```typescript
await observatory.destroy(); // Cleans up all handlers
```

---

## Plugins

```typescript
import { init, ObservabilityPlugin } from 'datadog-frontend-toolkit';

const myPlugin: ObservabilityPlugin = {
  name: 'my-custom-plugin',
  version: '1.0.0',
  setup(sdk) {
    sdk.addGlobalContext('plugin', 'active');
    sdk.onEvent('sdk:error_captured', (payload) => {
      // Custom error processing
    });
  },
  teardown() {
    // Cleanup
  },
};

init({
  clientToken: '...',
  applicationId: '...',
  service: 'my-app',
  env: 'production',
  plugins: [myPlugin],
});
```

---

## CLI — Resource Provisioning

The CLI provisions Datadog resources (dashboards, monitors, SLOs, and burn rate alerts) for your service automatically with an **interactive wizard**.

> **Note:** This uses Datadog API/App keys and runs server-side only. Never expose these keys in the browser.

### Setup Resources

```bash
# Interactive mode — prompts for everything
npx datadog-frontend-toolkit setup

# With CLI arguments
npx datadog-frontend-toolkit setup \
  --service my-app \
  --env production \
  --api-key $DD_API_KEY \
  --app-key $DD_APP_KEY \
  --team frontend

# Using environment variables (prompted for the rest)
export DD_API_KEY=your-api-key
export DD_APP_KEY=your-app-key
npx datadog-frontend-toolkit setup -s my-app -e production

# Dry run (preview only)
npx datadog-frontend-toolkit setup -s my-app -e production --dry-run

# Force update existing resources (keeps same URLs/IDs)
npx datadog-frontend-toolkit setup -s my-app -e production --force

# Skip specific resources
npx datadog-frontend-toolkit setup -s my-app -e production --no-slos
```

### Remove Resources

Delete all toolkit-managed resources for a given service/environment:

```bash
# Interactive confirmation before deleting
npx datadog-frontend-toolkit setup -s my-app -e production --remove

# Skip confirmation
npx datadog-frontend-toolkit setup -s my-app -e production --remove -y
```

This finds and deletes all monitors, SLOs, burn rate alerts, and dashboards tagged with `managed:datadog-frontend-toolkit` for the specified service and environment.

### Check Status

```bash
npx datadog-frontend-toolkit status -s my-app -e production
```

### What Gets Provisioned

**Dashboard (1):**
- Frontend Observability overview with RUM metrics, Web Vitals, error tracking, API endpoint errors, and performance panels

**Monitors (6):**
- High Frontend Error Rate (>50 errors/5min)
- Poor LCP Performance (avg LCP > 3s)
- High CLS Score (avg CLS > 0.2)
- JS Error Spike (>100 JS errors/5min)
- Error Log Anomaly (>200 error logs/15min)
- Poor INP Performance (avg INP > 400ms)

**SLOs (2) — environment-aware targets:**

| SLO | Type | Metric | Production | Non-production |
|-----|------|--------|------------|----------------|
| Frontend Availability | metric | `view.error_free / view` | 99.5% | 95% |
| Core Web Vitals (LCP) | time-slice | `p75 LCP < 2.5s` | 75% | 75% |

**Burn Rate Alerts (4) — Google SRE multi-window, multi-burn-rate:**

For each SLO, two burn rate alert monitors are created:

| Alert | Burn Rate | Window | Action |
|-------|-----------|--------|--------|
| High Burn Rate | ~14× (budget exhausted in ~2 days) | 1h long / 5m short | 🔥 Investigate immediately |
| Slow Burn Rate | ~6× (budget exhausted in ~5 days) | 6h long / 30m short | ⚠️ Create ticket, investigate within 24h |

> Burn rate thresholds are automatically clamped based on each SLO's target to stay within Datadog's allowed range (`max = 1/(1-target)`).

### Direct Access Links

After provisioning, the CLI outputs **clickable direct links** to every resource in Datadog:

```
✅ Dashboards:
   my-app - Frontend Observability
   https://app.datadoghq.com/dashboard/abc-def-ghi/...
✅ Monitors:
   my-app (production) - High Frontend Error Rate
   https://app.datadoghq.com/monitors/123456789
   my-app (production) - Frontend Availability - High Burn Rate
   https://app.datadoghq.com/monitors/123456790
   ...
✅ SLOs:
   my-app (production) - Frontend Availability
   https://app.datadoghq.com/slo?slo_id=abcdef123456
   my-app (production) - Core Web Vitals (LCP)
   https://app.datadoghq.com/slo?slo_id=abcdef789012
```

### Markdown Summary

A `datadog-observability-{service}.md` file is generated in the current directory with a full summary of all provisioned resources, descriptions, and direct links. You can commit this to your repo or share it with your team.

### Idempotent Execution

The CLI is safe to run multiple times. If a resource already exists (matched by name), it will be reused instead of duplicated. Individual resource failures are handled gracefully — one failing resource won't block the rest.

### Force Update (`--force`)

Use the `--force` flag to update existing resources in-place instead of skipping them. This preserves the same URLs and IDs, so your bookmarks and shared links remain valid.

```bash
# Update all resources with latest templates (keeps same URLs)
npx datadog-frontend-toolkit setup -s my-app -e production --force -y
```

This is useful when:
- Dashboard templates have been updated with new widgets or sections
- Monitor thresholds or queries need to be refreshed
- SLO targets or burn rate configurations have changed

---

## Framework Examples

### React

```typescript
// src/index.tsx
import { init } from 'datadog-frontend-toolkit';

const observatory = init({
  clientToken: process.env.REACT_APP_DD_CLIENT_TOKEN!,
  applicationId: process.env.REACT_APP_DD_APP_ID!,
  service: 'react-app',
  env: process.env.NODE_ENV,
  version: process.env.REACT_APP_VERSION,
});

export { observatory };
```

### Vue

```typescript
// src/main.ts
import { init } from 'datadog-frontend-toolkit';

const observatory = init({
  clientToken: import.meta.env.VITE_DD_CLIENT_TOKEN,
  applicationId: import.meta.env.VITE_DD_APP_ID,
  service: 'vue-app',
  env: import.meta.env.MODE,
});

app.config.errorHandler = (err) => {
  observatory.captureError(err instanceof Error ? err : new Error(String(err)));
};
```

### Angular

```typescript
// src/main.ts
import { init } from 'datadog-frontend-toolkit';

init({
  clientToken: environment.ddClientToken,
  applicationId: environment.ddAppId,
  service: 'angular-app',
  env: environment.production ? 'production' : 'development',
});
```

### Next.js

```typescript
// src/lib/observability.ts
import { init } from 'datadog-frontend-toolkit';

export const observatory =
  typeof window !== 'undefined'
    ? init({
        clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN!,
        applicationId: process.env.NEXT_PUBLIC_DD_APP_ID!,
        service: 'nextjs-app',
        env: process.env.NODE_ENV,
      })
    : null;
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  init(config)                    │
│                ObservabilitySDK                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   RUM    │  │   Logs   │  │    Logger     │  │
│  │ Manager  │  │ Manager  │  │   Service     │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Error   │  │  Perf    │  │   Network     │  │
│  │ Boundary │  │ Monitor  │  │ Interceptor   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Context  │  │ Bootstrap│  │    Event      │  │
│  │ Manager  │  │  Guard   │  │   Emitter     │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
         │
         ▼  (CLI only, server-side)
┌─────────────────────────────────────────────────┐
│           Resource Provisioner                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │ Monitor  │  │     SLO       │  │
│  │Templates │  │Templates │  │  Templates    │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
```

**Design Patterns Used:**
- **Singleton** — SDK instance management
- **Facade** — Single entry point for all features
- **Observer** — Event system for loose coupling
- **Adapter** — Log level normalization
- **Builder** — Configuration resolution
- **Chain of Responsibility** — Error processing pipeline
- **Proxy/Decorator** — Network interception
- **Template Method** — Resource provisioning

---

## License

MIT
