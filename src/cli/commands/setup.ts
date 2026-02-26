import * as fs from 'fs';
import * as path from 'path';
import { ResourceProvisioner } from '../../resources/ResourceProvisioner';
import type { ProvisioningConfig } from '../../types/config';
import { prompt, promptSecret, confirm, selectOrCustom } from '../prompt';

export async function setup(options: Record<string, string | boolean>): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('\x1b[36m%s\x1b[0m', '🚀 datadog-frontend-toolkit — Setup');
  // eslint-disable-next-line no-console
  console.log('');

  // Resolve values: CLI args → env vars → interactive prompt
  const service =
    (options['service'] as string) ||
    (await prompt('Service name', process.env.DD_SERVICE));

  const env =
    (options['env'] as string) ||
    (await selectOrCustom('Environment', ['production', 'staging', 'development', 'test']));

  const apiKey =
    (options['apiKey'] as string) ||
    process.env.DD_API_KEY ||
    (await promptSecret('Datadog API Key (DD_API_KEY)'));

  const appKey =
    (options['appKey'] as string) ||
    process.env.DD_APP_KEY ||
    (await promptSecret('Datadog App Key (DD_APP_KEY)'));

  const site =
    (options['site'] as string) ||
    process.env.DD_SITE ||
    (options['yes'] ? 'datadoghq.com' : await prompt('Datadog site', 'datadoghq.com'));

  const team =
    (options['team'] as string) ||
    (options['yes'] ? undefined : (await prompt('Team name (optional)')) || undefined);

  const dryRun = !!options['dryRun'];
  const force = !!options['force'];
  const remove = !!options['remove'];

  // Validate after prompts
  if (!service) {
    throw new Error('Service name is required');
  }
  if (!env) {
    throw new Error('Environment is required');
  }
  if (!apiKey) {
    throw new Error('Datadog API Key is required');
  }
  if (!appKey) {
    throw new Error('Datadog App Key is required');
  }

  // --remove: tear down all managed resources for this service/env
  if (remove) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('\x1b[33m%s\x1b[0m', `⚠️  This will DELETE all toolkit-managed resources for ${service} (${env})`);
    // eslint-disable-next-line no-console
    console.log('');

    const skipConfirm = !!options['yes'];
    if (!skipConfirm) {
      const confirmed = await confirm('Are you sure you want to proceed?');
      if (!confirmed) {
        // eslint-disable-next-line no-console
        console.log('Aborted.');
        return;
      }
    }

    const provisioner = new ResourceProvisioner({
      apiKey,
      appKey,
      site,
      tags: [`service:${service}`, `env:${env}`],
    });

    // eslint-disable-next-line no-console
    console.log('Removing resources...');
    // eslint-disable-next-line no-console
    console.log('');

    const result = await provisioner.teardown(service, env);

    if (result.deleted.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\x1b[32m%s\x1b[0m', '🗑️  Deleted:');
      for (const d of result.deleted) {
        // eslint-disable-next-line no-console
        console.log(`   ${d}`);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('No managed resources found.');
    }

    if (result.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('\x1b[31m%s\x1b[0m', '❌ Errors:');
      for (const e of result.errors) {
        // eslint-disable-next-line no-console
        console.log(`   ${e}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('\x1b[36m%s\x1b[0m', '✨ Teardown complete!');
    return;
  }

  // Ask which resources to provision (unless --yes or --no-* flags were passed)
  let dashboards = !options['noDashboards'];
  let monitors = !options['noMonitors'];
  let slos = !options['noSlos'];

  const skipPrompts = !!options['yes'];

  if (!skipPrompts && !options['noDashboards'] && !options['noMonitors'] && !options['noSlos']) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('  Resources to provision:');
    dashboards = await confirm('    Create Dashboard?');
    monitors = await confirm('    Create Monitors (6)?');
    slos = await confirm('    Create SLOs (1)?');
  }

  const provisioningConfig: ProvisioningConfig = {
    apiKey,
    appKey,
    site,
    team,
    dashboards,
    monitors,
    slos,
    force,
    tags: [`service:${service}`, `env:${env}`, ...(team ? [`team:${team}`] : [])],
  };

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('\x1b[36m%s\x1b[0m', '─── Configuration ───');
  // eslint-disable-next-line no-console
  console.log(`  Service:     ${service}`);
  // eslint-disable-next-line no-console
  console.log(`  Env:         ${env}`);
  // eslint-disable-next-line no-console
  console.log(`  Site:        ${site}`);
  if (team) {
    // eslint-disable-next-line no-console
    console.log(`  Team:        ${team}`);
  }
  // eslint-disable-next-line no-console
  console.log(`  Dashboards:  ${dashboards ? '✓' : '✗'}`);
  // eslint-disable-next-line no-console
  console.log(`  Monitors:    ${monitors ? '✓' : '✗'}`);
  // eslint-disable-next-line no-console
  console.log(`  SLOs:        ${slos ? '✓' : '✗'}`);
  if (force) {
    // eslint-disable-next-line no-console
    console.log(`  Force:       \x1b[33m✓ (update existing)\x1b[0m`);
  }
  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(`  Mode:        \x1b[33mdry-run\x1b[0m`);
  }
  // eslint-disable-next-line no-console
  console.log('');

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log('\x1b[33m%s\x1b[0m', '⚠️  DRY RUN — No resources will be created');
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Would provision:');

    if (provisioningConfig.dashboards) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ Dashboard: ${service} - Frontend Observability`);
    }
    if (provisioningConfig.monitors) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - High Frontend Error Rate`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - Poor LCP Performance`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - High CLS Score`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - JS Error Spike`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - Error Log Anomaly`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: ${service} (${env}) - Slow Page Load`);
    }
    if (provisioningConfig.slos) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: ${service} (${env}) - Frontend Availability`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: ${service} (${env}) - Core Web Vitals (LCP)`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Burn Rate Alert: Frontend Availability - High Burn Rate`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Burn Rate Alert: Frontend Availability - Slow Burn Rate`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Burn Rate Alert: Core Web Vitals (LCP) - High Burn Rate`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Burn Rate Alert: Core Web Vitals (LCP) - Slow Burn Rate`);
    }
    // eslint-disable-next-line no-console
    console.log('');
    return;
  }

  const provisioner = new ResourceProvisioner(provisioningConfig);

  // eslint-disable-next-line no-console
  console.log('Provisioning resources...');
  // eslint-disable-next-line no-console
  console.log('');

  const result = await provisioner.provision(service, env, provisioningConfig);

  // Report results
  const baseUrl = `https://app.${site}`;

  if (result.dashboards.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ Dashboards:');
    for (const d of result.dashboards) {
      // eslint-disable-next-line no-console
      console.log(`   ${d.title}`);
      // eslint-disable-next-line no-console
      console.log(`   \x1b[34m${baseUrl}${d.url}\x1b[0m`);
    }
  }

  if (result.monitors.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ Monitors:');
    for (const m of result.monitors) {
      // eslint-disable-next-line no-console
      console.log(`   ${m.name}`);
      // eslint-disable-next-line no-console
      console.log(`   \x1b[34m${baseUrl}/monitors/${m.id}\x1b[0m`);
    }
  }

  if (result.slos.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ SLOs:');
    for (const s of result.slos) {
      // eslint-disable-next-line no-console
      console.log(`   ${s.name}`);
      // eslint-disable-next-line no-console
      console.log(`   \x1b[34m${baseUrl}/slo?slo_id=${s.id}\x1b[0m`);
    }
  }

  if (result.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('\x1b[31m%s\x1b[0m', '❌ Errors:');
    for (const e of result.errors) {
      // eslint-disable-next-line no-console
      console.log(`   ${e}`);
    }
  }

  // Generate markdown summary
  const timestamp = new Date().toISOString();
  const lines: string[] = [
    `# 🔭 Datadog Observability — ${service}`,
    '',
    `> Auto-provisioned by \`datadog-frontend-toolkit\` on ${new Date().toLocaleString()}`,
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| **Service** | \`${service}\` |`,
    `| **Environment** | \`${env}\` |`,
    `| **Site** | \`${site}\` |`,
    ...(team ? [`| **Team** | \`${team}\` |`] : []),
    '',
  ];

  if (result.dashboards.length > 0) {
    lines.push('## 📊 Dashboards', '');
    lines.push('> A **Dashboard** is a visual overview that aggregates key metrics, logs, and traces into a single view for real-time monitoring of your service health.', '');
    for (const d of result.dashboards) {
      lines.push(`- **${d.title}**`);
      lines.push(`  ${baseUrl}${d.url}`);
    }
    lines.push('');
  }

  // Monitor descriptions keyed by pattern found in monitor name
  const monitorDescriptions: Record<string, string> = {
    'High Frontend Error Rate': 'Tracks the total number of RUM errors in a 5-minute window. Fires when errors exceed the threshold, indicating a potential regression or outage.',
    'Poor LCP Performance': '**Largest Contentful Paint (LCP)** measures how long it takes for the largest visible element to render. Values above 3 seconds indicate a poor loading experience (Core Web Vital).',
    'High CLS Score': '**Cumulative Layout Shift (CLS)** measures unexpected layout movements during page load. Values above 0.2 indicate visual instability that frustrates users (Core Web Vital).',
    'JS Error Spike': 'Detects sudden spikes in JavaScript source errors (>100 in 5 min). Often signals a bad deployment, broken third-party script, or infrastructure issue.',
    'Error Log Anomaly': 'Monitors backend/frontend error logs volume. A sudden increase (>200 in 15 min) may indicate an upstream service failure or configuration problem.',
    'Slow Page Load': '**Page Load Time** measures how long a view takes to be considered loaded. Values above 5 seconds indicate slow rendering or backend latency affecting user experience.',
    'High Burn Rate': '🔥 **High Burn Rate Alert** — The error budget is being consumed ~14× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~2 days. Requires immediate investigation.',
    'Slow Burn Rate': '⚠️ **Slow Burn Rate Alert** — The error budget is being consumed ~6× faster than sustainable. At this rate the entire 30-day budget will be exhausted in ~5 days. Create a ticket and investigate within 24 hours.',
  };

  if (result.monitors.length > 0) {
    lines.push('## 🚨 Monitors', '');
    lines.push('> A **Monitor** is an automated alert rule that continuously evaluates a metric or query and triggers notifications when thresholds are breached.', '');
    for (const m of result.monitors) {
      const desc = Object.entries(monitorDescriptions).find(([pattern]) => m.name.includes(pattern));
      lines.push(`### ${m.name}`);
      lines.push(`🔗 [Open in Datadog](${baseUrl}/monitors/${m.id})`, '');
      if (desc) {
        lines.push(`${desc[1]}`, '');
      }
    }
  }

  if (result.slos.length > 0) {
    lines.push('## 🎯 SLOs', '');
    lines.push('> A **Service Level Objective (SLO)** defines a target percentage of "good" events over a time window. It helps teams track reliability commitments and manage error budgets.', '');
    for (const s of result.slos) {
      lines.push(`### ${s.name}`);
      lines.push(`🔗 [Open in Datadog](${baseUrl}/slo?slo_id=${s.id})`, '');
      lines.push('Measures frontend availability as the ratio of error-free page views to total page views. Target: **99.5%** over 7d and 30d windows.', '');
    }
  }

  if (result.errors.length > 0) {
    lines.push('## ⚠️ Errors', '');
    for (const e of result.errors) {
      lines.push(`- ${e}`);
    }
    lines.push('');
  }

  lines.push('---', `_Generated at ${timestamp}_`);

  const mdFilename = `datadog-observability-${service}.md`;
  const mdPath = path.resolve(process.cwd(), mdFilename);
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8');

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`\x1b[36m📄 Summary saved to \x1b[1m${mdFilename}\x1b[0m`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('\x1b[36m%s\x1b[0m', '✨ Provisioning complete!');
}
