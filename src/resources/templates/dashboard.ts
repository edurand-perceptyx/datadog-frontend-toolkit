/**
 * Dashboard template for Datadog API provisioning.
 * Creates a comprehensive frontend observability dashboard.
 */
export function buildDashboardPayload(service: string, env: string, team?: string): Record<string, unknown> {
  const tags = team ? [`team:${team}`] : [];
  const tagFilter = tags.map((t) => t).join(',');

  return {
    title: `${service} - Frontend Observability`,
    description: `Auto-provisioned dashboard for ${service} by datadog-frontend-toolkit`,
    layout_type: 'ordered',
    tags,
    template_variables: [
      {
        name: 'env',
        prefix: 'env',
        default: env,
      },
    ],
    widgets: [
      // Header
      {
        definition: {
          type: 'note',
          content: `# ${service} Frontend Observability\n**Auto-provisioned** by datadog-frontend-toolkit — use the \`$env\` dropdown above to filter by environment.\n\n**Top section:** Key signals to detect production issues at a glance. **Bottom section:** Full observability detail for deep investigation.`,
          background_color: 'blue',
          font_size: '16',
          text_align: 'left',
          show_tick: false,
          tick_edge: 'left',
          tick_pos: '50%',
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // SECTION 1: Production Health — concise, actionable, error-focused
      // ═══════════════════════════════════════════════════════════════
      {
        definition: {
          type: 'group',
          title: '🚨 Production Health — Key Error Signals',
          layout_type: 'ordered',
          widgets: [
            // Row 1: Critical numbers at a glance
            {
              definition: {
                type: 'query_value',
                title: '⚠️ Error Rate',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'errors',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                      },
                      {
                        data_source: 'rum',
                        name: 'total',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                      },
                    ],
                    formulas: [{ formula: '(errors / total) * 100' }],
                    conditional_formats: [
                      { comparator: '>', value: 5, palette: 'white_on_red' },
                      { comparator: '>', value: 2, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 2, palette: 'white_on_green' },
                    ],
                  },
                ],
                autoscale: true,
                precision: 2,
                custom_unit: '%',
              },
            },
            {
              definition: {
                type: 'query_value',
                title: '🐛 JS Errors',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                      },
                    ],
                    conditional_formats: [
                      { comparator: '>', value: 100, palette: 'white_on_red' },
                      { comparator: '>', value: 20, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 20, palette: 'white_on_green' },
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
                title: '🔌 Failed API Calls (4xx/5xx)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                      },
                    ],
                    conditional_formats: [
                      { comparator: '>', value: 50, palette: 'white_on_red' },
                      { comparator: '>', value: 10, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 10, palette: 'white_on_green' },
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
                title: '😡 Rage Clicks',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:action @action.type:click @action.frustration.type:rage_click` },
                        indexes: ['*'],
                      },
                    ],
                    conditional_formats: [
                      { comparator: '>', value: 20, palette: 'white_on_red' },
                      { comparator: '>', value: 5, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 5, palette: 'white_on_green' },
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
                title: '⏱️ LCP (p75)',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.largest_contentful_paint' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                      },
                    ],
                    conditional_formats: [
                      { comparator: '>', value: 4000, palette: 'white_on_red' },
                      { comparator: '>', value: 2500, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 2500, palette: 'white_on_green' },
                    ],
                  },
                ],
                autoscale: true,
                precision: 0,
                custom_unit: 'ms',
              },
            },
            {
              definition: {
                type: 'query_value',
                title: '👥 Affected Sessions',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'cardinality', metric: '@session.id' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                      },
                    ],
                    conditional_formats: [
                      { comparator: '>', value: 50, palette: 'white_on_red' },
                      { comparator: '>', value: 10, palette: 'white_on_yellow' },
                      { comparator: '<=', value: 10, palette: 'white_on_green' },
                    ],
                  },
                ],
                autoscale: true,
                precision: 0,
              },
            },
            // Row 2: Error timeline — are errors spiking?
            {
              definition: {
                type: 'timeseries',
                title: '📈 Error Trend (is it spiking?)',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@error.source', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            // Row 3: What exactly is breaking?
            {
              definition: {
                type: 'toplist',
                title: '🔴 Top Errors — What is breaking?',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@error.message', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            {
              definition: {
                type: 'toplist',
                title: '🔌 Failing API Endpoints',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            // Row 4: Error logs trend from Logs product
            {
              definition: {
                type: 'timeseries',
                title: '📋 Error Logs Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'logs',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} @env:${env} status:(error OR critical)` },
                        indexes: ['*'],
                        group_by: [],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // SECTION 1.5: Deployment Health — version tracking & regression detection
      // ═══════════════════════════════════════════════════════════════
      {
        definition: {
          type: 'group',
          title: '🚀 Deployment Health — Version Tracking',
          layout_type: 'ordered',
          widgets: [
            // Error count by version
            {
              definition: {
                type: 'toplist',
                title: 'Errors by Version',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            // Sessions by version
            {
              definition: {
                type: 'toplist',
                title: 'Sessions by Version',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'cardinality', metric: '@session.id' },
                        search: { query: `service:${service} $env` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 10, sort: { aggregation: 'cardinality', metric: '@session.id', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            // Sessions by version over time
            {
              definition: {
                type: 'timeseries',
                title: 'Sessions by Version Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'cardinality', metric: '@session.id' },
                        search: { query: `service:${service} $env` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 5, sort: { aggregation: 'cardinality', metric: '@session.id', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            // Error rate by version over time
            {
              definition: {
                type: 'timeseries',
                title: 'Errors by Version Over Time',
                requests: [
                  {
                    response_format: 'timeseries',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 5, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                  },
                ],
              },
            },
            // LCP by version
            {
              definition: {
                type: 'toplist',
                title: 'LCP (p75) by Version',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.largest_contentful_paint' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 10, sort: { aggregation: 'pc75', metric: '@view.largest_contentful_paint', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            // Loading time by version
            {
              definition: {
                type: 'toplist',
                title: 'Loading Time (p75) by Version',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.loading_time' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 10, sort: { aggregation: 'pc75', metric: '@view.loading_time', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
            // CLS by version
            {
              definition: {
                type: 'toplist',
                title: 'CLS (p75) by Version',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'pc75', metric: '@view.cumulative_layout_shift' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: 'version', limit: 10, sort: { aggregation: 'pc75', metric: '@view.cumulative_layout_shift', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
                  },
                ],
              },
            },
          ],
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // SECTION 2: Detailed Observability — deep-dive investigation
      // ═══════════════════════════════════════════════════════════════
      {
        definition: {
          type: 'note',
          content: '---\n## 📊 Detailed Observability\nThe sections below provide full diagnostic data for deep investigation: traffic volume, Web Vitals trends, API error breakdown, geo performance, browser/device analysis, user frustration patterns, and resource loading.',
          background_color: 'gray',
          font_size: '14',
          text_align: 'left',
          show_tick: false,
          tick_edge: 'left',
          tick_pos: '50%',
        },
      },
      // Traffic Overview Group
      {
        definition: {
          type: 'group',
          title: 'Traffic Overview',
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
                        search: { query: `service:${service} $env` },
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
                title: 'Page Views',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                      },
                    ],
                  },
                ],
                autoscale: true,
                precision: 0,
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
                        search: { query: `service:${service} $env @type:view` },
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
                        search: { query: `service:${service} $env @type:view` },
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
                        search: { query: `service:${service} $env @type:view` },
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
                        search: { query: `service:${service} $env @type:view` },
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
                title: 'Errors by Status Code',
                requests: [
                  {
                    response_format: 'scalar',
                    queries: [
                      {
                        data_source: 'rum',
                        name: 'query1',
                        compute: { aggregation: 'count' },
                        search: { query: `service:${service} $env @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.status_code', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:resource @resource.type:(xhr OR fetch) @resource.status_code:>=400` },
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
                        search: { query: `service:${service} $env @type:view` },
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
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: '@view.name', limit: 10, sort: { aggregation: 'pc75', metric: '@view.loading_time', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:view` },
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
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@geo.country', limit: 15, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:view` },
                        indexes: ['*'],
                        group_by: [{ facet: '@geo.country', limit: 15, sort: { aggregation: 'pc75', metric: '@view.largest_contentful_paint', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@browser.name', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@os.name', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:error` },
                        indexes: ['*'],
                        group_by: [{ facet: '@device.type', limit: 10, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:view` },
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
      // User Frustration Group
      {
        definition: {
          type: 'group',
          title: 'User Frustration',
          layout_type: 'ordered',
          widgets: [
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
                        search: { query: `service:${service} $env @type:action @action.type:click @action.frustration.type:rage_click` },
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
                        search: { query: `service:${service} $env @type:action @action.type:click @action.frustration.type:rage_click` },
                        indexes: ['*'],
                        group_by: [{ facet: '@action.name', limit: 15, sort: { aggregation: 'count', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 15, sort: { aggregation: 'pc75', metric: '@resource.duration', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.url', limit: 15, sort: { aggregation: 'pc75', metric: '@resource.size', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
                        search: { query: `service:${service} $env @type:resource` },
                        indexes: ['*'],
                        group_by: [{ facet: '@resource.type', limit: 10, sort: { aggregation: 'pc75', metric: '@resource.duration', order: 'desc' } }],
                      },
                    ],
                    formulas: [{ formula: 'query1' }],
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
