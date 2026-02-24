import { StorageManager } from '../utils/storage';

interface BootstrapRecord {
  service: string;
  env: string;
  version: string;
  initializedAt: string;
  lastSeenAt: string;
  bootstrapCount: number;
}

const BOOTSTRAP_KEY = 'bootstrap_record';

/**
 * Guards against duplicate initialization and tracks bootstrap state.
 * Ensures the SDK is only initialized once per page lifecycle,
 * while persisting bootstrap history across sessions.
 */
export class BootstrapGuard {
  private static instance: BootstrapGuard | null = null;
  private readonly storage: StorageManager;
  private initialized = false;

  private constructor() {
    this.storage = new StorageManager();
  }

  static getInstance(): BootstrapGuard {
    if (!BootstrapGuard.instance) {
      BootstrapGuard.instance = new BootstrapGuard();
    }
    return BootstrapGuard.instance;
  }

  /**
   * Returns true if this is the first bootstrap for this service+env combination.
   */
  isFirstBootstrap(service: string, env: string): boolean {
    const record = this.getRecord(service, env);
    return record === undefined;
  }

  /**
   * Marks the current session as initialized.
   * Returns false if already initialized in this page lifecycle (prevents double-init).
   */
  markInitialized(service: string, env: string, version: string): boolean {
    if (this.initialized) {
      return false;
    }

    const existing = this.getRecord(service, env);
    const now = new Date().toISOString();

    const record: BootstrapRecord = {
      service,
      env,
      version,
      initializedAt: existing?.initializedAt ?? now,
      lastSeenAt: now,
      bootstrapCount: (existing?.bootstrapCount ?? 0) + 1,
    };

    this.storage.set(this.buildKey(service, env), record);
    this.initialized = true;
    return true;
  }

  /**
   * Returns the bootstrap record for a service+env combination.
   */
  getRecord(service: string, env: string): BootstrapRecord | undefined {
    return this.storage.get<BootstrapRecord>(this.buildKey(service, env));
  }

  /**
   * Resets the initialization flag (for teardown/testing).
   */
  reset(): void {
    this.initialized = false;
  }

  /**
   * Completely clears bootstrap state (for testing).
   */
  clear(): void {
    this.initialized = false;
    this.storage.clear();
  }

  /** @internal For testing only */
  static resetInstance(): void {
    BootstrapGuard.instance = null;
  }

  private buildKey(service: string, env: string): string {
    return `${BOOTSTRAP_KEY}_${service}_${env}`;
  }
}
