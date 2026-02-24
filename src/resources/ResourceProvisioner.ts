import type { ProvisioningConfig } from '../types/config';
import { buildDashboardPayload } from './templates/dashboard';
import { buildMonitorTemplates } from './templates/monitors';
import { buildSloTemplates } from './templates/slos';
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

    // Dashboards
    if (config.dashboards !== false) {
      try {
        const dashboard = await this.provisionDashboard(service, env, config.team);
        if (dashboard) result.dashboards.push(dashboard);
      } catch (err) {
        result.errors.push(`Dashboard: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Monitors
    if (config.monitors !== false) {
      try {
        const monitors = await this.provisionMonitors(service, env, config);
        result.monitors.push(...monitors);
      } catch (err) {
        result.errors.push(`Monitors: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // SLOs
    if (config.slos !== false) {
      try {
        const slos = await this.provisionSlos(service, env, config.team);
        result.slos.push(...slos);
      } catch (err) {
        result.errors.push(`SLOs: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }

  private async provisionDashboard(
    service: string,
    env: string,
    team?: string,
  ): Promise<{ id: string; title: string; url: string } | null> {
    // Check if dashboard already exists
    const existing = await this.findExistingDashboard(service, env);
    if (existing) {
      return existing;
    }

    const payload = buildDashboardPayload(service, env, team);

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
  ): Promise<{ id: number; name: string }[]> {
    const templates = buildMonitorTemplates(
      service,
      env,
      config.notificationChannels,
      config.team,
    );

    const results: { id: number; name: string }[] = [];

    for (const template of templates) {
      const existing = await this.findExistingMonitor(template.name);
      if (existing) {
        results.push(existing);
        continue;
      }

      const response = await this.apiRequest('POST', '/v1/monitor', {
        name: template.name,
        type: template.type,
        query: template.query,
        message: template.message,
        tags: template.tags,
        options: template.options,
      });

      results.push({ id: response.id as number, name: response.name as string });
    }

    return results;
  }

  private async provisionSlos(
    service: string,
    env: string,
    team?: string,
  ): Promise<{ id: string; name: string }[]> {
    const templates = buildSloTemplates(service, env, team);
    const results: { id: string; name: string }[] = [];

    for (const template of templates) {
      const existing = await this.findExistingSlo(template.name);
      if (existing) {
        results.push(existing);
        continue;
      }

      const response = await this.apiRequest('POST', '/v1/slo', {
        name: template.name,
        description: template.description,
        type: template.type,
        query: template.query,
        thresholds: template.thresholds,
        tags: template.tags,
      });

      const responseData = response.data as Array<Record<string, unknown>> | undefined;
      results.push({
        id: (responseData?.[0]?.id ?? response.id) as string,
        name: template.name,
      });
    }

    return results;
  }

  private async findExistingDashboard(
    service: string,
    env: string,
  ): Promise<{ id: string; title: string; url: string } | null> {
    try {
      const response = await this.apiRequest('GET', '/v1/dashboard');
      const dashboards = (response.dashboards || []) as Array<Record<string, unknown>>;

      const existing = dashboards.find(
        (d: Record<string, unknown>) =>
          typeof d.title === 'string' &&
          d.title.includes(`[Auto] ${service}`) &&
          d.title.includes(env),
      );

      if (existing) {
        return {
          id: existing.id as string,
          title: existing.title as string,
          url: `https://app.datadoghq.com/dashboard/${existing.id}`,
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
    } catch {
      // If search fails, proceed with creation
    }
    return null;
  }

  private async findExistingSlo(
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    try {
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
