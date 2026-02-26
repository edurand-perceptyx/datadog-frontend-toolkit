#!/usr/bin/env node

import { setup } from './commands/setup';
import { status } from './commands/status';

const args = process.argv.slice(2);
const command = args[0];

const HELP_TEXT = `
  datadog-frontend-toolkit CLI

  Usage:
    datadog-frontend-toolkit <command> [options]

  Commands:
    setup     Provision Datadog resources (dashboards, monitors, SLOs)
    status    Check provisioning status for a service

  Options:
    --service, -s     Service name (required)
    --env, -e         Environment (required)
    --api-key         Datadog API key (or DD_API_KEY env var)
    --app-key         Datadog Application key (or DD_APP_KEY env var)
    --site            Datadog site (default: datadoghq.com)
    --team            Team name for resource ownership
    --no-dashboards   Skip dashboard provisioning
    --no-monitors     Skip monitor provisioning
    --no-slos         Skip SLO provisioning
    --load-size       Traffic load profile: low, medium, high, very-high (default: interactive)
    --notify          Notification target (repeatable). Auto-detects type from format:
                        email:   user@company.com
                        slack:   alerts-channel@company.slack.com  or  @slack-alerts-channel
                        pagerduty: @pagerduty-my-service
                        webhook: @webhook-my-hook
                        opsgenie: @opsgenie-my-team
    --force           Update existing resources instead of skipping them
    --remove          Delete all toolkit-managed resources for the given service/env
    --yes, -y         Skip interactive prompts (create all resources)
    --dry-run         Preview what would be created without making changes
    --help, -h        Show this help message

  Examples:
    datadog-frontend-toolkit setup -s my-app -e production --api-key <key> --app-key <key>
    datadog-frontend-toolkit setup -s my-app -e staging --team frontend --dry-run
    datadog-frontend-toolkit setup -s my-app -e production --team frontend --load-size medium -y
    datadog-frontend-toolkit setup -s my-app -e production --notify alerts@company.slack.com
    datadog-frontend-toolkit setup -s my-app -e production --notify @slack-fe-alerts --notify ops@company.com
    datadog-frontend-toolkit setup -s my-app -e production --remove
    datadog-frontend-toolkit status -s my-app -e production
`;

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed['help'] = true;
    } else if (arg === '--dry-run') {
      parsed['dryRun'] = true;
    } else if (arg === '--no-dashboards') {
      parsed['noDashboards'] = true;
    } else if (arg === '--no-monitors') {
      parsed['noMonitors'] = true;
    } else if (arg === '--no-slos') {
      parsed['noSlos'] = true;
    } else if (arg === '--force') {
      parsed['force'] = true;
    } else if (arg === '--remove') {
      parsed['remove'] = true;
    } else if (arg === '--yes' || arg === '-y') {
      parsed['yes'] = true;
    } else if ((arg === '--service' || arg === '-s') && args[i + 1]) {
      parsed['service'] = args[++i];
    } else if ((arg === '--env' || arg === '-e') && args[i + 1]) {
      parsed['env'] = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      parsed['apiKey'] = args[++i];
    } else if (arg === '--app-key' && args[i + 1]) {
      parsed['appKey'] = args[++i];
    } else if (arg === '--site' && args[i + 1]) {
      parsed['site'] = args[++i];
    } else if (arg === '--team' && args[i + 1]) {
      parsed['team'] = args[++i];
    } else if (arg === '--load-size' && args[i + 1]) {
      parsed['loadSize'] = args[++i];
    } else if (arg === '--notify' && args[i + 1]) {
      const val = args[++i];
      parsed['notify'] = parsed['notify'] ? `${parsed['notify']},${val}` : val;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    // eslint-disable-next-line no-console
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const options = parseArgs(args.slice(1));

  if (options['help']) {
    // eslint-disable-next-line no-console
    console.log(HELP_TEXT);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'setup':
        await setup(options);
        break;
      case 'status':
        await status(options);
        break;
      default:
        // eslint-disable-next-line no-console
        console.error(`Unknown command: ${command}`);
        // eslint-disable-next-line no-console
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      '\x1b[31m%s\x1b[0m',
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

main();
