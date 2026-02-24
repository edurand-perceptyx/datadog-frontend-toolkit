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
    (await prompt('Datadog site', 'datadoghq.com'));

  const team =
    (options['team'] as string) ||
    (await prompt('Team name (optional)')) ||
    undefined;

  const dryRun = !!options['dryRun'];

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

  // Ask which resources to provision (unless flags were passed)
  let dashboards = !options['noDashboards'];
  let monitors = !options['noMonitors'];
  let slos = !options['noSlos'];

  if (!options['noDashboards'] && !options['noMonitors'] && !options['noSlos']) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('  Resources to provision:');
    dashboards = await confirm('    Create Dashboard?');
    monitors = await confirm('    Create Monitors (6)?');
    slos = await confirm('    Create SLOs (4)?');
  }

  const provisioningConfig: ProvisioningConfig = {
    apiKey,
    appKey,
    site,
    team,
    dashboards,
    monitors,
    slos,
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
      console.log(`  ✓ Dashboard: [Auto] ${service} - Frontend Observability`);
    }
    if (provisioningConfig.monitors) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - High Frontend Error Rate`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - Poor LCP Performance`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - High CLS Score`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - JS Error Spike`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - Error Log Anomaly`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ Monitor: [Auto] ${service} (${env}) - Poor INP Performance`);
    }
    if (provisioningConfig.slos) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: [Auto] ${service} (${env}) - Frontend Availability`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: [Auto] ${service} (${env}) - LCP Performance`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: [Auto] ${service} (${env}) - INP Performance`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ SLO: [Auto] ${service} (${env}) - CLS Performance`);
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
  if (result.dashboards.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ Dashboards:');
    for (const d of result.dashboards) {
      // eslint-disable-next-line no-console
      console.log(`   ${d.title} → ${d.url}`);
    }
  }

  if (result.monitors.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ Monitors:');
    for (const m of result.monitors) {
      // eslint-disable-next-line no-console
      console.log(`   ${m.name} (id: ${m.id})`);
    }
  }

  if (result.slos.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m%s\x1b[0m', '✅ SLOs:');
    for (const s of result.slos) {
      // eslint-disable-next-line no-console
      console.log(`   ${s.name} (id: ${s.id})`);
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

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('\x1b[36m%s\x1b[0m', '✨ Provisioning complete!');
}
