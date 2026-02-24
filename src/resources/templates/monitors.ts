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

export function buildMonitorTemplates(
  service: string,
  env: string,
  channels: NotificationChannel[] = [],
  team?: string,
): MonitorTemplate[] {
  const tags = [`service:${service}`, `env:${env}`, 'managed:datadog-frontend-toolkit', ...(team ? [`team:${team}`] : [])];
  const notify = channels.length > 0 ? `\n\nNotify: ${buildNotificationString(channels)}` : '';

  return [
    // High Error Rate Monitor
    {
      name: `[Auto] ${service} (${env}) - High Frontend Error Rate`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:error").rollup("count").by("@error.source").last("5m") > 50`,
      message: `## High Frontend Error Rate\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe frontend error rate has exceeded the threshold of 50 errors in 5 minutes.\n\nPlease investigate the error source in the [RUM Error Tracking](https://app.datadoghq.com/rum/error-tracking?query=service%3A${service}%20env%3A${env}).${notify}`,
      tags,
      options: {
        thresholds: { critical: 50, warning: 25 },
        notify_no_data: false,
        renotify_interval: 30,
        escalation_message: `Error rate still elevated for ${service} (${env})`,
        include_tags: true,
        new_group_delay: 60,
      },
    },

    // Poor LCP Monitor
    {
      name: `[Auto] ${service} (${env}) - Poor LCP Performance`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("percentile", "@view.largest_contentful_paint", 75).last("15m") > 4000`,
      message: `## Poor LCP Performance\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe 75th percentile Largest Contentful Paint has exceeded 4 seconds (poor threshold).\n\nThis directly impacts user experience and Core Web Vitals scores.${notify}`,
      tags,
      options: {
        thresholds: { critical: 4000, warning: 2500 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },

    // High CLS Monitor
    {
      name: `[Auto] ${service} (${env}) - High CLS Score`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("percentile", "@view.cumulative_layout_shift", 75).last("15m") > 0.25`,
      message: `## High Cumulative Layout Shift\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe 75th percentile CLS has exceeded 0.25 (poor threshold).\n\nLayout shifts are causing a poor user experience.${notify}`,
      tags,
      options: {
        thresholds: { critical: 0.25, warning: 0.1 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },

    // JavaScript Error Spike
    {
      name: `[Auto] ${service} (${env}) - JS Error Spike`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:error @error.source:source").rollup("count").last("5m") > 100`,
      message: `## JavaScript Error Spike\n\n**Service:** ${service}\n**Environment:** ${env}\n\nA spike in JavaScript errors has been detected (>100 in 5 minutes).\n\nThis may indicate a deployment issue or third-party script failure.${notify}`,
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
      name: `[Auto] ${service} (${env}) - Error Log Anomaly`,
      type: 'log alert',
      query: `logs("service:${service} env:${env} status:error").index("*").rollup("count").last("15m") > 200`,
      message: `## Error Log Anomaly\n\n**Service:** ${service}\n**Environment:** ${env}\n\nAn unusual number of error logs have been detected.\n\nCheck [Log Explorer](https://app.datadoghq.com/logs?query=service%3A${service}%20env%3A${env}%20status%3Aerror) for details.${notify}`,
      tags,
      options: {
        thresholds: { critical: 200, warning: 100 },
        notify_no_data: false,
        renotify_interval: 30,
        include_tags: true,
      },
    },

    // Poor INP Monitor
    {
      name: `[Auto] ${service} (${env}) - Poor INP Performance`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("percentile", "@view.interaction_to_next_paint", 75).last("15m") > 500`,
      message: `## Poor Interaction to Next Paint\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe 75th percentile INP has exceeded 500ms (poor threshold).\n\nUser interactions are feeling sluggish.${notify}`,
      tags,
      options: {
        thresholds: { critical: 500, warning: 200 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },
  ];
}
