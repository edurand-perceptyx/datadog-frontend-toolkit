import * as fs from 'fs';
import * as path from 'path';
import { ResourceProvisioner } from '../../resources/ResourceProvisioner';
import type { ProvisioningConfig, LoadSize, NotificationChannel } from '../../types/config';
import { LOAD_SIZE_LABELS } from '../../resources/templates/monitors';
import { prompt, promptSecret, confirm, selectOrCustom, select } from '../prompt';

/**
 * Auto-detect notification channel type from a target string.
 *  - *@*.slack.com          → slack (Slack email integration)
 *  - @slack-*               → slack (Datadog native)
 *  - @pagerduty-*           → pagerduty
 *  - @opsgenie-*            → opsgenie
 *  - @webhook-*             → webhook
 *  - anything else with @   → email
 */
function parseNotifyTarget(raw: string): NotificationChannel {
  const t = raw.trim();
  if (t.match(/@.+\.slack\.com$/i)) {
    return { type: 'slack', target: t };
  }
  if (t.startsWith('@slack-')) {
    return { type: 'slack', target: t.replace(/^@slack-/, '') };
  }
  if (t.startsWith('@pagerduty-')) {
    return { type: 'pagerduty', target: t.replace(/^@pagerduty-/, '') };
  }
  if (t.startsWith('@opsgenie-')) {
    return { type: 'opsgenie', target: t.replace(/^@opsgenie-/, '') };
  }
  if (t.startsWith('@webhook-')) {
    return { type: 'webhook', target: t.replace(/^@webhook-/, '') };
  }
  return { type: 'email', target: t };
}

const NOTIFY_TYPE_LABELS: Record<string, string> = {
  slack: '🔔 Slack',
  email: '📧 Email',
  pagerduty: '🚨 PagerDuty',
  opsgenie: '🔔 OpsGenie',
  webhook: '🔗 Webhook',
};

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

  const VALID_LOAD_SIZES: LoadSize[] = ['low', 'medium', 'high', 'very-high'];
  let loadSize: LoadSize;
  const loadSizeArg = options['loadSize'] as string | undefined;
  if (loadSizeArg && VALID_LOAD_SIZES.includes(loadSizeArg as LoadSize)) {
    loadSize = loadSizeArg as LoadSize;
  } else if (options['yes']) {
    loadSize = 'low';
  } else {
    const loadSizeOptions = VALID_LOAD_SIZES.map((k) => LOAD_SIZE_LABELS[k]);
    const selected = await select('Expected traffic load for this service:', loadSizeOptions, 0);
    loadSize = VALID_LOAD_SIZES[loadSizeOptions.indexOf(selected)] ?? 'low';
  }

  // Notification channels: --notify flags → interactive prompt
  const notificationChannels: NotificationChannel[] = [];
  const notifyArg = options['notify'] as string | undefined;
  if (notifyArg) {
    for (const raw of notifyArg.split(',')) {
      if (raw.trim()) notificationChannels.push(parseNotifyTarget(raw));
    }
  }
  if (!notifyArg && !options['yes']) {
    // eslint-disable-next-line no-console
    console.log('\x1b[36m%s\x1b[0m', '📣 Notification Channels');
    // eslint-disable-next-line no-console
    console.log('   Monitors and burn rate alerts will notify these targets when triggered.');
    // eslint-disable-next-line no-console
    console.log('   Supported formats:');
    // eslint-disable-next-line no-console
    console.log('     • Slack email:    alerts-channel@company.slack.com');
    // eslint-disable-next-line no-console
    console.log('     • Slack native:   @slack-alerts-channel');
    // eslint-disable-next-line no-console
    console.log('     • Email:          user@company.com');
    // eslint-disable-next-line no-console
    console.log('     • PagerDuty:      @pagerduty-my-service');
    // eslint-disable-next-line no-console
    console.log('');

    let addMore = true;
    while (addMore) {
      const target = await prompt('Notification target (leave empty to skip)');
      if (!target) break;
      const channel = parseNotifyTarget(target);
      notificationChannels.push(channel);
      // eslint-disable-next-line no-console
      console.log(`   ✓ Added: ${NOTIFY_TYPE_LABELS[channel.type] || channel.type} → ${channel.target}`);
      addMore = await confirm('Add another notification target?', false);
    }
  }

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
    loadSize,
    notificationChannels,
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
  // eslint-disable-next-line no-console
  console.log(`  Load Size:   ${loadSize}`);
  if (notificationChannels.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`  Notify:      ${notificationChannels.map((ch) => `${NOTIFY_TYPE_LABELS[ch.type] || ch.type} → ${ch.target}`).join(', ')}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`  Notify:      (none)`);
  }
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
    `| **Load Profile** | \`${loadSize}\` |`,
    ...(team ? [`| **Team** | \`${team}\` |`] : []),
    ...(notificationChannels.length > 0
      ? [`| **Notifications** | ${notificationChannels.map((ch) => `\`${ch.type}: ${ch.target}\``).join(', ')} |`]
      : []),
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
  // Thresholds shown here are dynamically generated based on selected load size
  const { THRESHOLDS_BY_LOAD } = await import('../../resources/templates/monitors');
  const th = THRESHOLDS_BY_LOAD[loadSize];
  const monitorDescriptions: Record<string, string> = {
    'High Frontend Error Rate': `Tracks the total number of RUM errors in a ${th.errorRate.window} window. Fires when errors exceed ${th.errorRate.critical} (load profile: **${loadSize}**), indicating a potential regression or outage.`,
    'Poor LCP Performance': '**Largest Contentful Paint (LCP)** measures how long it takes for the largest visible element to render. Values above 3 seconds indicate a poor loading experience (Core Web Vital).',
    'High CLS Score': '**Cumulative Layout Shift (CLS)** measures unexpected layout movements during page load. Values above 0.2 indicate visual instability that frustrates users (Core Web Vital).',
    'JS Error Spike': `Detects sudden spikes in JavaScript source errors (>${th.jsSpike.critical} in ${th.jsSpike.window}, load profile: **${loadSize}**). Often signals a bad deployment, broken third-party script, or infrastructure issue.`,
    'Error Log Anomaly': `Monitors backend/frontend error logs volume. A sudden increase (>${th.logAnomaly.critical} in ${th.logAnomaly.window}, load profile: **${loadSize}**) may indicate an upstream service failure or configuration problem.`,
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
