/**
 * SLO templates for Datadog API provisioning.
 * Creates frontend-focused SLOs for availability and performance.
 */

export interface SloTemplate {
  name: string;
  description: string;
  type: string;
  query: Record<string, unknown>;
  thresholds: Array<{ timeframe: string; target: number; warning?: number }>;
  tags: string[];
}

export function buildSloTemplates(
  service: string,
  env: string,
  team?: string,
): SloTemplate[] {
  const tags = [
    `service:${service}`,
    `env:${env}`,
    'managed:datadog-frontend-toolkit',
    ...(team ? [`team:${team}`] : []),
  ];

  return [
    // Frontend Availability SLO (based on error rate)
    {
      name: `[Auto] ${service} (${env}) - Frontend Availability`,
      description: `Frontend availability for ${service} in ${env}. Measures the percentage of page views without JavaScript errors. Managed by datadog-frontend-toolkit.`,
      type: 'metric',
      query: {
        numerator: `count:rum.view.count{service:${service},env:${env}} - count:rum.error.count{service:${service},env:${env}}`,
        denominator: `count:rum.view.count{service:${service},env:${env}}`,
      },
      thresholds: [
        { timeframe: '7d', target: 99.5, warning: 99.9 },
        { timeframe: '30d', target: 99.5, warning: 99.9 },
        { timeframe: '90d', target: 99.5, warning: 99.9 },
      ],
      tags,
    },

    // LCP Performance SLO
    {
      name: `[Auto] ${service} (${env}) - LCP Performance`,
      description: `LCP performance for ${service} in ${env}. Measures the percentage of page views with LCP under 2.5s (good threshold). Managed by datadog-frontend-toolkit.`,
      type: 'metric',
      query: {
        numerator: `count:rum.largest_contentful_paint.count{service:${service},env:${env},@view.largest_contentful_paint:<2500}`,
        denominator: `count:rum.largest_contentful_paint.count{service:${service},env:${env}}`,
      },
      thresholds: [
        { timeframe: '7d', target: 75.0, warning: 85.0 },
        { timeframe: '30d', target: 75.0, warning: 85.0 },
      ],
      tags,
    },

    // INP Performance SLO
    {
      name: `[Auto] ${service} (${env}) - INP Performance`,
      description: `INP performance for ${service} in ${env}. Measures the percentage of interactions with INP under 200ms (good threshold). Managed by datadog-frontend-toolkit.`,
      type: 'metric',
      query: {
        numerator: `count:rum.interaction_to_next_paint.count{service:${service},env:${env},@view.interaction_to_next_paint:<200}`,
        denominator: `count:rum.interaction_to_next_paint.count{service:${service},env:${env}}`,
      },
      thresholds: [
        { timeframe: '7d', target: 75.0, warning: 85.0 },
        { timeframe: '30d', target: 75.0, warning: 85.0 },
      ],
      tags,
    },

    // CLS Performance SLO
    {
      name: `[Auto] ${service} (${env}) - CLS Performance`,
      description: `CLS performance for ${service} in ${env}. Measures the percentage of page views with CLS under 0.1 (good threshold). Managed by datadog-frontend-toolkit.`,
      type: 'metric',
      query: {
        numerator: `count:rum.cumulative_layout_shift.count{service:${service},env:${env},@view.cumulative_layout_shift:<0.1}`,
        denominator: `count:rum.cumulative_layout_shift.count{service:${service},env:${env}}`,
      },
      thresholds: [
        { timeframe: '7d', target: 75.0, warning: 85.0 },
        { timeframe: '30d', target: 75.0, warning: 85.0 },
      ],
      tags,
    },
  ];
}
