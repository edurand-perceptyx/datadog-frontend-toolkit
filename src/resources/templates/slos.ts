/**
 * SLO templates for Datadog API provisioning.
 * Uses metric-based SLOs with RUM queries (monitor-based SLOs do NOT
 * support RUM alert or log alert monitors).
 */

export interface SloTemplate {
  name: string;
  description: string;
  type: string;
  query?: {
    numerator: string;
    denominator: string;
  };
  thresholds: Array<{ timeframe: string; target: number; warning?: number }>;
  tags: string[];
}

export function buildSloTemplates(
  service: string,
  env: string,
  _monitorIds: { id: number; name: string }[],
  team?: string,
): SloTemplate[] {
  const tags = [
    ...(team ? [`team:${team}`] : []),
  ];

  return [
    {
      name: `${service} (${env}) - Frontend Availability`,
      description: 'Measures frontend availability based on RUM error rate. Managed by datadog-frontend-toolkit.',
      type: 'metric',
      query: {
        numerator: `sum:rum.measure.view.error_free{service:${service},env:${env}}.as_count()`,
        denominator: `sum:rum.measure.view{service:${service},env:${env}}.as_count()`,
      },
      thresholds: [
        { timeframe: '7d', target: 99.5, warning: 99.9 },
        { timeframe: '30d', target: 99.5, warning: 99.9 },
      ],
      tags,
    },
  ];
}
