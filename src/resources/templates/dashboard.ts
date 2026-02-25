/**
 * Dashboard template for Datadog API provisioning.
 * Creates a comprehensive frontend observability dashboard.
 */
export function buildDashboardPayload(service: string, env: string, team?: string): Record<string, unknown> {
  const tags = team ? [`team:${team}`] : [];
  const tagFilter = tags.map((t) => t).join(',');

  return {
    title: `${service} - Frontend Observability`,
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
            {
              definition: {
                type: 'timeseries',
                title: 'First Contentful Paint (FCP)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.first_contentful_paint' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
                markers: [
                  { value: 'y = 1800', display_type: 'warning dashed', label: 'Good threshold' },
                  { value: 'y = 3000', display_type: 'error dashed', label: 'Poor threshold' },
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
      // API Endpoint Errors Group
      {
        definition: {
          type: 'group',
          title: 'API Endpoint Errors',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'toplist',
                title: 'Top Failing Endpoints (by count)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 25, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Errors by Status Code',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.status_code', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'timeseries',
                title: 'API Errors Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
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
      // Geo Performance Group
      {
        definition: {
          type: 'group',
          title: 'Performance by Country',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'geomap',
                title: 'Page Load Time by Country',
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
                        group_by: [{ facet: '@geo.country_iso_code', limit: 50, sort: { aggregation: 'pc75', metric: '@view.loading_time', order: 'desc' } }],
                      },
                    ],
                  },
                ],
                style: { palette: 'hostmap_blues', palette_flip: false },
                view: { focus: 'WORLD' },
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Errors by Country',
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
                        group_by: [{ facet: '@geo.country', limit: 15, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'LCP by Country (p75)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.largest_contentful_paint' },
                        search: { query: `service:${service} env:${env} @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: '@geo.country', limit: 15, sort: { aggregation: 'pc75', metric: '@view.largest_contentful_paint', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      // Browser & Device Group
      {
        definition: {
          type: 'group',
          title: 'Browser & Device Breakdown',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'toplist',
                title: 'Errors by Browser',
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
                        group_by: [{ facet: '@browser.name', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Errors by OS',
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
                        group_by: [{ facet: '@os.name', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Errors by Device Type',
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
                        group_by: [{ facet: '@device.type', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'timeseries',
                title: 'LCP by Browser (p75)',
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
                        group_by: [{ facet: '@browser.name', limit: 5, sort: { aggregation: 'pc75', metric: '@view.largest_contentful_paint', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      // Frustrated Sessions Group
      {
        definition: {
          type: 'group',
          title: 'User Frustration',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'query_value',
                title: 'Frustrated Sessions',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'cardinality', metric: '@session.id' },
                        search: { query: `service:${service} env:${env} @type:error` },
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
                title: 'Rage Clicks',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:action @action.type:click @action.frustration.type:rage_click` },
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
                type: 'timeseries',
                title: 'Rage Clicks Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:action @action.type:click @action.frustration.type:rage_click` },
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
                title: 'Top Rage Click Targets',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} env:${env} @type:action @action.type:click @action.frustration.type:rage_click` },
                        indexes: ['*'],
                        group_by: [{ facet: '@action.name', limit: 15, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      // Resource Loading Group
      {
        definition: {
          type: 'group',
          title: 'Resource Loading',
          layout_type: 'ordered',
          widgets: [
            {
              definition: {
                type: 'toplist',
                title: 'Slowest Resources (p75 duration)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@resource.duration' },
                        search: { query: `service:${service} env:${env} @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 15, sort: { aggregation: 'pc75', metric: '@resource.duration', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Largest Resources (by size)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@resource.size' },
                        search: { query: `service:${service} env:${env} @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 15, sort: { aggregation: 'pc75', metric: '@resource.size', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: 'Slowest Resources by Type',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@resource.duration' },
                        search: { query: `service:${service} env:${env} @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.type', limit: 10, sort: { aggregation: 'pc75', metric: '@resource.duration', order: 'desc' } }],
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
