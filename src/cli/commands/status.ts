import { prompt, promptSecret, selectOrCustom } from '../prompt';

export async function status(options: Record<string, string | boolean>): Promise<void> {
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
    'datadoghq.com';

  if (!service) {
    throw new Error('Service name is required');
  }
  if (!env) {
    throw new Error('Environment is required');
  }
  if (!apiKey || !appKey) {
    throw new Error('Datadog API Key and App Key are required');
  }

  const baseUrl = `https://api.${site}/api`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'DD-API-KEY': apiKey,
    'DD-APPLICATION-KEY': appKey,
  };

  const managedTag = 'managed:datadog-frontend-toolkit';

  // eslint-disable-next-line no-console
  console.log('\x1b[36m%s\x1b[0m', '📊 datadog-frontend-toolkit — Status Check');
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`  Service: ${service}`);
  // eslint-disable-next-line no-console
  console.log(`  Env:     ${env}`);
  // eslint-disable-next-line no-console
  console.log('');

  // Check dashboards
  try {
    const dashRes = await fetch(`${baseUrl}/v1/dashboard`, { headers });
    if (dashRes.ok) {
      const data = (await dashRes.json()) as { dashboards?: Array<{ id: string; title: string }> };
      const managed = (data.dashboards || []).filter(
        (d) => d.title.includes(`[Auto] ${service}`) && d.title.includes(env),
      );
      // eslint-disable-next-line no-console
      console.log(`  Dashboards: ${managed.length > 0 ? '✅' : '❌'} ${managed.length} found`);
      for (const d of managed) {
        // eslint-disable-next-line no-console
        console.log(`    → ${d.title} (${d.id})`);
      }
    }
  } catch {
    // eslint-disable-next-line no-console
    console.log('  Dashboards: ⚠️  Could not check');
  }

  // Check monitors
  try {
    const monRes = await fetch(`${baseUrl}/v1/monitor?tag=${encodeURIComponent(managedTag)}`, { headers });
    if (monRes.ok) {
      const monitors = (await monRes.json()) as Array<{ id: number; name: string; overall_state: string }>;
      const relevant = monitors.filter(
        (m) => m.name.includes(service) && m.name.includes(env),
      );
      // eslint-disable-next-line no-console
      console.log(`  Monitors:   ${relevant.length > 0 ? '✅' : '❌'} ${relevant.length} found`);
      for (const m of relevant) {
        const stateIcon = m.overall_state === 'OK' ? '🟢' : m.overall_state === 'Alert' ? '🔴' : '🟡';
        // eslint-disable-next-line no-console
        console.log(`    ${stateIcon} ${m.name} (${m.overall_state})`);
      }
    }
  } catch {
    // eslint-disable-next-line no-console
    console.log('  Monitors:   ⚠️  Could not check');
  }

  // Check SLOs
  try {
    const sloRes = await fetch(`${baseUrl}/v1/slo?tags_query=${encodeURIComponent(managedTag)}`, { headers });
    if (sloRes.ok) {
      const data = (await sloRes.json()) as { data?: Array<{ id: string; name: string }> };
      const relevant = (data.data || []).filter(
        (s) => s.name.includes(service) && s.name.includes(env),
      );
      // eslint-disable-next-line no-console
      console.log(`  SLOs:       ${relevant.length > 0 ? '✅' : '❌'} ${relevant.length} found`);
      for (const s of relevant) {
        // eslint-disable-next-line no-console
        console.log(`    → ${s.name} (${s.id})`);
      }
    }
  } catch {
    // eslint-disable-next-line no-console
    console.log('  SLOs:       ⚠️  Could not check');
  }

  // eslint-disable-next-line no-console
  console.log('');
}
