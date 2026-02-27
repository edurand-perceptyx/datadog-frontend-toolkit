# 🔭 Datadog Observability — analytics-studio-frontend

> Auto-provisioned by `datadog-frontend-toolkit` on 2/27/2026, 3:58:56 PM

| Field | Value |
|-------|-------|
| **Service** | `analytics-studio-frontend` |
| **Environment** | `production` |
| **Site** | `datadoghq.com` |
| **Load Profile** | `low` |
| **Team** | `analyze` |
| **Notifications** | `slack: as-dd-frontend-alerts-aaaatir7kltbikbocwlajx4snm@perceptyx.slack.com` |

## 🚨 Monitors

> A **Monitor** is an automated alert rule that continuously evaluates a metric or query and triggers notifications when thresholds are breached.

### analytics-studio-frontend (production) - High Frontend Error Rate
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687664)

Tracks the total number of RUM errors in a 15m window. Fires when errors exceed 10 (load profile: **low**), indicating a potential regression or outage.

### analytics-studio-frontend (production) - Poor LCP Performance
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687670)

**Largest Contentful Paint (LCP)** measures how long it takes for the largest visible element to render. Values above 3 seconds indicate a poor loading experience (Core Web Vital).

### analytics-studio-frontend (production) - High CLS Score
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687675)

**Cumulative Layout Shift (CLS)** measures unexpected layout movements during page load. Values above 0.2 indicate visual instability that frustrates users (Core Web Vital).

### analytics-studio-frontend (production) - JS Error Spike
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687680)

Detects sudden spikes in JavaScript source errors (>25 in 15m, load profile: **low**). Often signals a bad deployment, broken third-party script, or infrastructure issue.

### analytics-studio-frontend (production) - Error Log Anomaly
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687690)

Monitors backend/frontend error logs volume. A sudden increase (>50 in 15m, load profile: **low**) may indicate an upstream service failure or configuration problem.

### analytics-studio-frontend (production) - Slow Page Load
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261698575)

**Page Load Time** measures how long a view takes to be considered loaded. Values above 5 seconds indicate slow rendering or backend latency affecting user experience.

### analytics-studio-frontend (production) - Frontend Availability - High Burn Rate
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687725)

🔥 **High Burn Rate Alert** — The error budget is being consumed ~14× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~2 days. Requires immediate investigation.

### analytics-studio-frontend (production) - Frontend Availability - Slow Burn Rate
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687733)

⚠️ **Slow Burn Rate Alert** — The error budget is being consumed ~6× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~5 days. Create a ticket and investigate within 24 hours.

### analytics-studio-frontend (production) - Core Web Vitals (LCP) - High Burn Rate
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687738)

🔥 **High Burn Rate Alert** — The error budget is being consumed ~14× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~2 days. Requires immediate investigation.

### analytics-studio-frontend (production) - Core Web Vitals (LCP) - Slow Burn Rate
🔗 [Open in Datadog](https://app.datadoghq.com/monitors/261687744)

⚠️ **Slow Burn Rate Alert** — The error budget is being consumed ~6× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~5 days. Create a ticket and investigate within 24 hours.

## 🎯 SLOs

> A **Service Level Objective (SLO)** defines a target percentage of "good" events over a time window. It helps teams track reliability commitments and manage error budgets.

### analytics-studio-frontend (production) - Frontend Availability
🔗 [Open in Datadog](https://app.datadoghq.com/slo?slo_id=35d5b829409d54eda45de68f952e8405)

Measures frontend availability as the ratio of error-free page views to total page views. Target: **99.5%** over 7d and 30d windows.

### analytics-studio-frontend (production) - Core Web Vitals (LCP)
🔗 [Open in Datadog](https://app.datadoghq.com/slo?slo_id=f216d87bbbe1599894d8e2ffa589c869)

Measures frontend availability as the ratio of error-free page views to total page views. Target: **99.5%** over 7d and 30d windows.

## ⚠️ Errors

- Dashboard: Datadog API error 400: {"errors":["Invalid widget definition at position 2 of type group. Error: Invalid inner widget definition at position 9 of type log_stream. Error: {'field': 'status_line', 'width': 'auto'} is not of type 'string'."]}

---
_Generated at 2026-02-27T18:58:56.013Z_