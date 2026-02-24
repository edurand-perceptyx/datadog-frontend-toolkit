/**
 * Dashboard template for Datadog API provisioning.
 * Creates a comprehensive frontend observability dashboard.
 */
export function buildDashboardPayload(service: string, env: string, team?: string): Record<string, unknown> {
  const tags = team ? [`team:${team}`] : [];
  const tagFilter = tags.map((t) => t).join(',');

  return {
    title: `[Auto] ${service} - Frontend Observability`,
    description: `Auto-provisioned dashboard for ${service} (${env}) by datadog-frontend-toolkit`,
    layout_type: 'ordered',
    tags,
    widgets: [
      // Header
      {
        definition: {
          type: 'note',
          content: `# ${service} Frontend Observability\n**Environment:** ${env} | **Auto-provisioned** by datadog-frontend-toolkit`,
          background_color: 'blue',
          font_size: '16',
          text_align: 'left',
          show_tick: false,
          tick_edge: 'left',
          tick_pos: '50%',
        },
      },
      // RUM Overview Group
      {
        definition: {
          type: 'group',
          title: 'Real User Monitoring',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'query_value',
                title: 'Active Sessions',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'cardinality', metric: '@session.id' },
                        search: { query: `service:${service} env:${env}` },
                        indexes: ['*'],
                      },
                    ],
                  },
                ],
                autoscale: true,
                precision: 0,
              },
            },
            {
              definition: {
                type: 'query_value',
                title: 'Page Views (1h)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                      },
                    ],
                  },
                ],
                autoscale: true,
                precision: 0,
              },
            },
            {
              definition: {
                type: 'query_value',
                title: 'Error Rate',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'errors',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:error` },
                        indexes: ['*'],
                      },
                      {
                        data_source: 'rum',
                        name: 'total',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                      },
                    ],
                    formulas: [{ formula: '(errors / total) * 100' }],
                  },
                ],
                autoscale: true,
                precision: 2,
                custom_unit: '%',
              },
            },
          ],
        },
      },
      // Web Vitals Group
      {
        definition: {
          type: 'group',
          title: 'Web Vitals',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'timeseries',
                title: 'Largest Contentful Paint (LCP)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.largest_contentful_paint' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
                markers: [
                  { value: 'y = 2500', display_type: 'warning dashed', label: 'Good threshold' },
                  { value: 'y = 4000', display_type: 'error dashed', label: 'Poor threshold' },
                ],
              },
            },
            {
              definition: {
                type: 'timeseries',
                title: 'Cumulative Layout Shift (CLS)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.cumulative_layout_shift' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
                markers: [
                  { value: 'y = 0.1', display_type: 'warning dashed', label: 'Good threshold' },
                  { value: 'y = 0.25', display_type: 'error dashed', label: 'Poor threshold' },
                ],
              },
            },
            {
              definition: {
                type: 'timeseries',
                title: 'Interaction to Next Paint (INP)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.interaction_to_next_paint' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
                markers: [
                  { value: 'y = 200', display_type: 'warning dashed', label: 'Good threshold' },
                  { value: 'y = 500', display_type: 'error dashed', label: 'Poor threshold' },
                ],
              },
            },
          ],
        },
      },
      // Errors Group
      {
        definition: {
          type: 'group',
          title: 'Errors & Logs',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'timeseries',
                title: 'Errors Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@error.source', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Top Errors',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@error.message', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'log_stream',
                title: 'Recent Error Logs',
                query: `service:${service} env:${env} status:(error OR critical)`,
                columns: ['timestamp', 'message', 'status'],
                indexes: [],
                message_display: 'expanded-md',
                show_date_column: true,
                show_message_column: true,
                sort: { column: 'time', order: 'desc' },
              },
            },
          ],
        },
      },
      // Performance Group
      {
        definition: {
          type: 'group',
          title: 'Performance',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'timeseries',
                title: 'Page Load Time (p75)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.loading_time' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Slowest Views',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.loading_time' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: '@view.name', limit: 10, sort: { aggregation: 'pc75', metric: '@view.loading_time', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      // Footer tag info
      {
        definition: {
          type: 'note',
          content: `**Tags:** ${tagFilter}\n\nManaged by \`datadog-frontend-toolkit\`. Do not edit manually.`,
          background_color: 'gray',
          font_size: '12',
          text_align: 'left',
          show_tick: false,
          tick_edge: 'left',
          tick_pos: '50%',
        },
      },
    ],
  };
}
