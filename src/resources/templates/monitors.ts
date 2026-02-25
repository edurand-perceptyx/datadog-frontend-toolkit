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
      message: `## High Frontend Error Rate\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe frontend error rate has exceeded the threshold of 50 errors in 5 minutes.\n\nPlease investigate the error source in the [RUM Error Tracking](https://app.datadoghq.com/rum/error-tracking?query=service%3A${service}%20env%3A${env}).${notify}`,
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
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.largest_contentful_paint").last("15m") > 3000000000`,
      message: `## Poor LCP Performance\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average Largest Contentful Paint has exceeded 3 seconds.\n\nThis directly impacts user experience and Core Web Vitals scores.${notify}`,
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
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.cumulative_layout_shift").last("15m") > 0.2`,
      message: `## High Cumulative Layout Shift\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average CLS has exceeded 0.2.\n\nLayout shifts are causing a poor user experience.${notify}`,
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
      name: `${service} (${env}) - Error Log Anomaly`,
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
      name: `${service} (${env}) - Poor INP Performance`,
      type: 'rum alert',
      query: `rum("service:${service} env:${env} @type:view").rollup("avg", "@view.interaction_to_next_paint").last("15m") > 400000000`,
      message: `## Poor Interaction to Next Paint\n\n**Service:** ${service}\n**Environment:** ${env}\n\nThe average INP has exceeded 400ms.\n\nUser interactions are feeling sluggish.${notify}`,
      tags,
      options: {
        thresholds: { critical: 400000000, warning: 200000000 },
        notify_no_data: false,
        renotify_interval: 60,
        include_tags: true,
      },
    },
  ];
}
