import type { ObservabilityConfig, ResolvedConfig } from '../types/config';
import { LogLevel } from '../types/config';

/**
 * Resolves user-provided config with sensible defaults.
 * Validates required fields and applies environment-aware defaults.
 * Follows the Builder pattern to construct a fully resolved config.
 */
export class ConfigManager {
  private static readonly REQUIRED_FIELDS: (keyof ObservabilityConfig)[] = [
    'clientToken',
    'applicationId',
    'service',
    'env',
  ];

  static resolve(config: ObservabilityConfig): ResolvedConfig {
    ConfigManager.validate(config);

    const isDev = config.env === 'development' || config.env === 'test';

    return {
      // Required
      clientToken: config.clientToken,
      applicationId: config.applicationId,
      service: config.service,
      env: config.env,

      // Core with defaults
      version: config.version ?? '0.0.0',
      site: config.site ?? 'datadoghq.com',
      debug: config.debug ?? isDev,
      logLevel: config.logLevel ?? (isDev ? LogLevel.DEBUG : LogLevel.WARN),
      consoleOutput: config.consoleOutput ?? isDev,

      // Sampling
      sampling: {
        sessionSampleRate: config.sampling?.sessionSampleRate ?? 100,
        sessionReplaySampleRate: config.sampling?.sessionReplaySampleRate ?? 20,
        traceSampleRate: config.sampling?.traceSampleRate ?? 100,
        logSampleRate: config.sampling?.logSampleRate ?? 100,
      },

      // Network
      network: {
        enabled: config.network?.enabled ?? true,
        excludeUrls: config.network?.excludeUrls ?? [],
        trackHeaders: config.network?.trackHeaders ?? false,
        trackBodies: config.network?.trackBodies ?? false,
        maxBodySize: config.network?.maxBodySize ?? 4096,
        failedOnly: config.network?.failedOnly ?? false,
      },

      // Performance
      performance: {
        webVitals: config.performance?.webVitals ?? true,
        longTasks: config.performance?.longTasks ?? true,
        longTaskThreshold: config.performance?.longTaskThreshold ?? 50,
        resourceTiming: config.performance?.resourceTiming ?? true,
        firstInputDelay: config.performance?.firstInputDelay ?? true,
        cumulativeLayoutShift: config.performance?.cumulativeLayoutShift ?? true,
        largestContentfulPaint: config.performance?.largestContentfulPaint ?? true,
        interactionToNextPaint: config.performance?.interactionToNextPaint ?? true,
        customMarks: config.performance?.customMarks ?? [],
      },

      // Error tracking
      errorTracking: {
        enabled: config.errorTracking?.enabled ?? true,
        unhandledRejections: config.errorTracking?.unhandledRejections ?? true,
        consoleErrors: config.errorTracking?.consoleErrors ?? true,
        ignorePatterns: config.errorTracking?.ignorePatterns ?? [],
        maxErrorsPerMinute: config.errorTracking?.maxErrorsPerMinute ?? 100,
        captureStackTraces: config.errorTracking?.captureStackTraces ?? true,
        fingerprint: config.errorTracking?.fingerprint,
      },

      // Session
      session: {
        enabled: config.session?.enabled ?? true,
        timeout: config.session?.timeout ?? 1800000,
        crossTabSync: config.session?.crossTabSync ?? true,
      },

      // Actions
      actions: {
        trackUserInteractions: config.actions?.trackUserInteractions ?? true,
        trackFrustrations: config.actions?.trackFrustrations ?? true,
        trackViewsManually: config.actions?.trackViewsManually ?? false,
      },

      // Privacy
      privacy: {
        defaultPrivacyLevel: config.privacy?.defaultPrivacyLevel ?? 'mask-user-input',
        piiFields: config.privacy?.piiFields ?? [],
        requireConsent: config.privacy?.requireConsent ?? false,
        consentPurposes: config.privacy?.consentPurposes ?? [],
      },

      // Context
      user: config.user,
      globalContext: config.globalContext ?? {},
      tags: config.tags ?? [],
      plugins: config.plugins ?? [],
      hooks: config.hooks ?? {},

      // Advanced
      proxy: config.proxy,
      allowedTracingUrls: config.allowedTracingUrls ?? [],
      rumOverrides: config.rumOverrides ?? {},
      logsOverrides: config.logsOverrides ?? {},
      provisioning: config.provisioning,
    };
  }

  static validate(config: ObservabilityConfig): void {
    const errors: string[] = [];

    for (const field of ConfigManager.REQUIRED_FIELDS) {
      if (!config[field]) {
        errors.push(`Missing required field: '${field}'`);
      }
    }

    if (config.sampling?.sessionSampleRate !== undefined) {
      ConfigManager.validateRange('sampling.sessionSampleRate', config.sampling.sessionSampleRate, 0, 100, errors);
    }

    if (config.sampling?.sessionReplaySampleRate !== undefined) {
      ConfigManager.validateRange('sampling.sessionReplaySampleRate', config.sampling.sessionReplaySampleRate, 0, 100, errors);
    }

    if (config.sampling?.traceSampleRate !== undefined) {
      ConfigManager.validateRange('sampling.traceSampleRate', config.sampling.traceSampleRate, 0, 100, errors);
    }

    if (config.errorTracking?.maxErrorsPerMinute !== undefined && config.errorTracking.maxErrorsPerMinute < 1) {
      errors.push('errorTracking.maxErrorsPerMinute must be >= 1');
    }

    if (errors.length > 0) {
      throw new Error(
        `[dd-frontend-toolkit] Configuration errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }
  }

  private static validateRange(
    field: string,
    value: number,
    min: number,
    max: number,
    errors: string[],
  ): void {
    if (value < min || value > max) {
      errors.push(`${field} must be between ${min} and ${max}, got ${value}`);
    }
  }
}
