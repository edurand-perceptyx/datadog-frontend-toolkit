import type { ProvisioningConfig } from '../types/config';
import { buildDashboardPayload } from './templates/dashboard';
import { buildMonitorTemplates } from './templates/monitors';
import { buildSloTemplates, BURN_RATE_ALERTS } from './templates/slos';
import { withRetry } from '../utils/retry';

interface ProvisioningResult {
  dashboards: { id: string; title: string; url: string }[];
  monitors: { id: number; name: string }[];
  slos: { id: string; name: string }[];
  errors: string[];
}

const MANAGED_TAG = 'managed:datadog-frontend-toolkit';

/**
 * Provisions Datadog resources (dashboards, monitors, SLOs) via the Datadog API.
 *
 * **IMPORTANT:** This class uses Datadog API/App keys and must NEVER run in the browser.
 * It is designed for CLI or server-side use only.
 *
 * Follows the Template Method pattern — each resource type has a standard
 * create/check/skip flow.
 */
export class ResourceProvisioner {
  private readonly apiKey: string;
  private readonly appKey: string;
  private readonly baseUrl: string;

  constructor(config: ProvisioningConfig) {
    this.apiKey = config.apiKey;
    this.appKey = config.appKey;
    this.baseUrl = `https://api.${config.site || 'datadoghq.com'}/api`;
  }

  /**
   * Provisions all configured resources for a service.
   * Checks for existing resources to avoid duplicates.
   */
  async provision(
    service: string,
    env: string,
    config: ProvisioningConfig,
  ): Promise<ProvisioningResult> {
    const result: ProvisioningResult = {
      dashboards: [],
      monitors: [],
      slos: [],
      errors: [],
    };

    const force = !!config.force;

    // Dashboards
    if (config.dashboards !== false) {
      try {
        const dashboard = await this.provisionDashboard(service, env, config.team, force);
        if (dashboard) result.dashboards.push(dashboard);
      } catch (err) {
        result.errors.push(`Dashboard: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Monitors (each created independently)
    if (config.monitors !== false) {
      const monitorResults = await this.provisionMonitors(service, env, config, force);
      result.monitors.push(...monitorResults.created);
      result.errors.push(...monitorResults.errors);
    }

    // SLOs (metric-based and time-slice)
    if (config.slos !== false) {
      const sloResults = await this.provisionSlos(service, env, result.monitors, config.team, force);
      result.slos.push(...sloResults.created.map(({ id, name }) => ({ id, name })));
      result.errors.push(...sloResults.errors);

      // Burn-rate alerts for each SLO (Google SRE multi-window approach)
      const burnRateResults = await this.provisionBurnRateAlerts(
        sloResults.created,
        service,
        env,
        config.notificationChannels,
        config.team,
        force,
      );
      result.monitors.push(...burnRateResults.created);
      result.errors.push(...burnRateResults.errors);
    }

    return result;
  }

  private async provisionDashboard(
    service: string,
    env: string,
    team?: string,
    force?: boolean,
  ): Promise<{ id: string; title: string; url: string } | null> {
    const existing = await this.findExistingDashboard(service, env);
    const payload = buildDashboardPayload(service, env, team);

    if (existing && force) {
      const response = await this.apiRequest('PUT', `/v1/dashboard/${existing.id}`, payload);
      return {
        id: existing.id,
        title: response.title as string,
        url: existing.url,
      };
    }

    if (existing) {
      return existing;
    }

    const response = await this.apiRequest('POST', '/v1/dashboard', payload);
    return {
      id: response.id as string,
      title: response.title as string,
      url: response.url as string,
    };
  }

  private async provisionMonitors(
    service: string,
    env: string,
    config: ProvisioningConfig,
    force?: boolean,
  ): Promise<{ created: { id: number; name: string }[]; errors: string[] }> {
    const templates = buildMonitorTemplates(
      service,
      env,
      config.notificationChannels,
      config.team,
    );

    const created: { id: number; name: string }[] = [];
    const errors: string[] = [];

    for (const template of templates) {
      try {
        const existing = await this.findExistingMonitor(template.name);

        const monitorPayload = {
          name: template.name,
          type: template.type,
          query: template.query,
          message: template.message,
          tags: template.tags,
          options: template.options,
        };

        if (existing && force) {
          await this.apiRequest('PUT', `/v1/monitor/${existing.id}`, monitorPayload);
          created.push(existing);
          continue;
        }

        if (existing) {
          created.push(existing);
          continue;
        }

        const response = await this.apiRequest('POST', '/v1/monitor', monitorPayload);
        created.push({ id: response.id as number, name: response.name as string });
      } catch (err) {
        errors.push(`Monitor "${template.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { created, errors };
  }

  private async provisionSlos(
    service: string,
    env: string,
    monitorIds: { id: number; name: string }[],
    team?: string,
    force?: boolean,
  ): Promise<{ created: { id: string; name: string; target: number }[]; errors: string[] }> {
    const templates = buildSloTemplates(service, env, monitorIds, team);
    const created: { id: string; name: string; target: number }[] = [];
    const errors: string[] = [];

    for (const template of templates) {
      try {
        const existing = await this.findExistingSlo(template.name);

        const sloPayload: Record<string, unknown> = {
          name: template.name,
          description: template.description,
          type: template.type,
          thresholds: template.thresholds,
          tags: template.tags,
        };

        if (template.query) {
          sloPayload.query = template.query;
        }
        if (template.sli_specification) {
          sloPayload.sli_specification = template.sli_specification;
        }

        const maxTarget = Math.max(...template.thresholds.map(t => t.target));

        if (existing && force) {
          await this.apiRequest('PUT', `/v1/slo/${existing.id}`, sloPayload);
          created.push({ ...existing, target: maxTarget });
          continue;
        }

        if (existing) {
          created.push({ ...existing, target: maxTarget });
          continue;
        }

        const response = await this.apiRequest('POST', '/v1/slo', sloPayload);

        const responseData = response.data as Array<Record<string, unknown>> | undefined;
        created.push({
          id: (responseData?.[0]?.id ?? response.id) as string,
          name: template.name,
          target: maxTarget,
        });
      } catch (err) {
        errors.push(`SLO "${template.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { created, errors };
  }

  /**
   * Provisions burn-rate alert monitors for each SLO.
   * Uses the Google SRE multi-window, multi-burn-rate approach:
   *   - High burn (14.4×): 1h long / 5m short window → page
   *   - Slow burn (6×):    6h long / 30m short window → ticket
   */
  private async provisionBurnRateAlerts(
    slos: { id: string; name: string; target: number }[],
    service: string,
    env: string,
    channels: import('../types/config').NotificationChannel[] = [],
    team?: string,
    force?: boolean,
  ): Promise<{ created: { id: number; name: string }[]; errors: string[] }> {
    const created: { id: number; name: string }[] = [];
    const errors: string[] = [];

    const tags = [
      `service:${service}`,
      `env:${env}`,
      'source:terraform',
      'managed:datadog-frontend-toolkit',
      ...(team ? [`team:${team}`] : []),
    ];

    const notify = channels && channels.length > 0
      ? `\n\nNotify: ${channels.map((ch) => `@${ch.type === 'slack' ? 'slack-' : ''}${ch.target}`).join(' ')}`
      : '';

    for (const slo of slos) {
      // Max burn rate = 1 / (1 - target/100). Thresholds must stay below this.
      const maxBurnRate = 1 / (1 - slo.target / 100);

      for (const alert of BURN_RATE_ALERTS) {
        // Clamp thresholds to 90% of max to stay within Datadog's allowed range
        const clampedCritical = Math.min(alert.critical, Math.floor(maxBurnRate * 0.9 * 10) / 10);
        const clampedWarning = Math.min(alert.warning, Math.floor(clampedCritical * 0.5 * 10) / 10);

        const monitorName = `${slo.name} - ${alert.nameSuffix}`;

        try {
          const existing = await this.findExistingMonitor(monitorName);

          const monitorPayload = {
            name: monitorName,
            type: 'slo alert',
            query: `burn_rate("${slo.id}").over("7d").long_window("${alert.long_window}").short_window("${alert.short_window}") > ${clampedCritical}`,
            message: `${alert.message}\n\n**SLO:** ${slo.name}\n**Service:** ${service}\n**Environment:** ${env}${notify}`,
            tags,
            options: {
              thresholds: { critical: clampedCritical, warning: clampedWarning },
              notify_no_data: false,
              include_tags: true,
            },
          };

          if (existing && force) {
            await this.apiRequest('PUT', `/v1/monitor/${existing.id}`, monitorPayload);
            created.push(existing);
            continue;
          }

          if (existing) {
            created.push(existing);
            continue;
          }

          const response = await this.apiRequest('POST', '/v1/monitor', monitorPayload);
          created.push({ id: response.id as number, name: monitorName });
        } catch (err) {
          errors.push(`Burn rate "${monitorName}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return { created, errors };
  }

  /**
   * Tears down (deletes) all toolkit-managed resources for the given service/env.
   * Deletion order: monitors first (including burn-rate alerts), then SLOs, then dashboards.
   */
  async teardown(
    service: string,
    env: string,
  ): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    // 1. Find and delete all managed monitors (includes burn-rate alerts)
    try {
      const response = await this.apiRequest(
        'GET',
        `/v1/monitor?tag=${encodeURIComponent(MANAGED_TAG)}`,
      );
      const monitors = Array.isArray(response) ? response : [];
      const serviceMonitors = monitors.filter(
        (m: Record<string, unknown>) =>
          typeof m.name === 'string' &&
          (m.name as string).includes(`${service} (${env})`),
      );

      for (const m of serviceMonitors) {
        try {
          await this.apiRequest('DELETE', `/v1/monitor/${m.id}?force=true`);
          deleted.push(`Monitor: ${m.name}`);
        } catch (err) {
          errors.push(`Delete monitor "${m.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`List monitors: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Find and delete all managed SLOs
    try {
      const response = await this.apiRequest(
        'GET',
        `/v1/slo?tags_query=${encodeURIComponent(MANAGED_TAG)}`,
      );
      const slos = ((response.data || []) as Array<Record<string, unknown>>).filter(
        (s: Record<string, unknown>) =>
          typeof s.name === 'string' &&
          (s.name as string).includes(`${service} (${env})`),
      );

      for (const s of slos) {
        try {
          await this.apiRequest('DELETE', `/v1/slo/${s.id}?force=true`);
          deleted.push(`SLO: ${s.name}`);
        } catch (err) {
          errors.push(`Delete SLO "${s.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`List SLOs: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. Find and delete dashboard
    try {
      const dashboard = await this.findExistingDashboard(service, env);
      if (dashboard) {
        await this.apiRequest('DELETE', `/v1/dashboard/${dashboard.id}`);
        deleted.push(`Dashboard: ${dashboard.title}`);
      }
    } catch (err) {
      errors.push(`Delete dashboard: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { deleted, errors };
  }

  private async findExistingDashboard(
    service: string,
    env: string,
  ): Promise<{ id: string; title: string; url: string } | null> {
    try {
      const response = await this.apiRequest('GET', '/v1/dashboard');
      const dashboards = (response.dashboards || []) as Array<Record<string, unknown>>;

      // Match current format (without env) or legacy format (with env)
      const existing = dashboards.find(
        (d: Record<string, unknown>) =>
          typeof d.title === 'string' &&
          (d.title === `${service} - Frontend Observability` ||
           d.title === `${service} (${env}) - Frontend Observability`),
      );

      if (existing) {
        return {
          id: existing.id as string,
          title: existing.title as string,
          url: `/dashboard/${existing.id}`,
        };
      }
    } catch {
      // If search fails, proceed with creation
    }
    return null;
  }

  private async findExistingMonitor(
    name: string,
  ): Promise<{ id: number; name: string } | null> {
    try {
      // First try searching by managed tag
      const response = await this.apiRequest(
        'GET',
        `/v1/monitor?tag=${encodeURIComponent(MANAGED_TAG)}`,
      );

      const monitors = Array.isArray(response) ? response : [];
      const existing = monitors.find(
        (m: Record<string, unknown>) => m.name === name,
      );

      if (existing) {
        return { id: existing.id as number, name: existing.name as string };
      }

      // Fallback: search by name across all monitors (for resources created before managed tag was added)
      const nameResponse = await this.apiRequest(
        'GET',
        `/v1/monitor?name=${encodeURIComponent(name)}`,
      );
      const allMonitors = Array.isArray(nameResponse) ? nameResponse : [];
      const byName = allMonitors.find(
        (m: Record<string, unknown>) => m.name === name,
      );
      if (byName) {
        return { id: byName.id as number, name: byName.name as string };
      }
    } catch {
      // If search fails, proceed with creation
    }
    return null;
  }

  private async findExistingSlo(
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    try {
      // First try searching by managed tag
      const response = await this.apiRequest(
        'GET',
        `/v1/slo?tags_query=${encodeURIComponent(MANAGED_TAG)}`,
      );

      const slos = (response.data || []) as Array<Record<string, unknown>>;
      const existing = slos.find(
        (s: Record<string, unknown>) => s.name === name,
      );

      if (existing) {
        return { id: existing.id as string, name: existing.name as string };
      }

      // Fallback: search all SLOs by name (for resources created before managed tag was added)
      const allResponse = await this.apiRequest('GET', '/v1/slo');
      const allSlos = (allResponse.data || []) as Array<Record<string, unknown>>;
      const byName = allSlos.find(
        (s: Record<string, unknown>) => s.name === name,
      );
      if (byName) {
        return { id: byName.id as string, name: byName.name as string };
      }
    } catch {
      // If search fails, proceed with creation
    }
    return null;
  }

  private async apiRequest(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    return withRetry(
      async () => {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey,
        };

        const options: RequestInit = { method, headers };
        if (body && method !== 'GET') {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Datadog API error ${response.status}: ${errorBody}`,
          );
        }

        return (await response.json()) as Record<string, unknown>;
      },
      {
        maxAttempts: 3,
        shouldRetry: (error, _attempt) => {
          if (error instanceof Error && error.message.includes('429')) return true;
          if (error instanceof Error && error.message.includes('5')) return true;
          return false;
        },
      },
    );
  }
}
