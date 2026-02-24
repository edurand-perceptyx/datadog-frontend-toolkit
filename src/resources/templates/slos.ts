/**
 * SLO templates for Datadog API provisioning.
 * Uses monitor-based SLOs that reference the provisioned RUM monitors.
 */

export interface SloTemplate {
  name: string;
  description: string;
  type: string;
  monitor_ids: number[];
  thresholds: Array<{ timeframe: string; target: number; warning?: number }>;
  tags: string[];
}

export interface MonitorSloMapping {
  /** Pattern to match against the monitor name */
  monitorPattern: string;
  sloName: string;
  sloDescription: string;
  target: number;
  warning: number;
}

// Note: Only metric monitors and synthetics monitors are supported for
// monitor-based SLOs. RUM alert and log alert monitors are NOT supported.
// The Frontend Availability SLO uses the error rate count monitor which
// is the most compatible option.
const SLO_MAPPINGS: MonitorSloMapping[] = [
  {
    monitorPattern: 'High Frontend Error Rate',
    sloName: 'Frontend Availability',
    sloDescription: 'Measures frontend availability based on error rate monitor health.',
    target: 99.5,
    warning: 99.9,
  },
];

export function buildSloTemplates(
  service: string,
  env: string,
  monitorIds: { id: number; name: string }[],
  team?: string,
): SloTemplate[] {
  const tags = [
    ...(team ? [`team:${team}`] : []),
  ];

  const slos: SloTemplate[] = [];

  for (const mapping of SLO_MAPPINGS) {
    const monitor = monitorIds.find((m) => m.name.includes(mapping.monitorPattern));
    if (!monitor) continue;

    slos.push({
      name: `[Auto] ${service} (${env}) - ${mapping.sloName}`,
      description: `${mapping.sloDescription} Managed by datadog-frontend-toolkit.`,
      type: 'monitor',
      monitor_ids: [monitor.id],
      thresholds: [
        { timeframe: '7d', target: mapping.target, warning: mapping.warning },
        { timeframe: '30d', target: mapping.target, warning: mapping.warning },
      ],
      tags,
    });
  }

  return slos;
}
