const STORAGE_PREFIX = 'dd_toolkit_';

/**
 * Safe localStorage wrapper that handles SSR, private browsing,
 * and storage quota exceeded scenarios.
 */
export class StorageManager {
  private readonly prefix: string;
  private memoryFallback: Map<string, string>;
  private useMemory: boolean;

  constructor(prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix;
    this.memoryFallback = new Map();
    this.useMemory = !this.isLocalStorageAvailable();
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const raw = this.useMemory
        ? this.memoryFallback.get(this.prefixKey(key))
        : localStorage.getItem(this.prefixKey(key));

      if (raw === null || raw === undefined) {
        return defaultValue;
      }

      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      if (this.useMemory) {
        this.memoryFallback.set(this.prefixKey(key), serialized);
      } else {
        localStorage.setItem(this.prefixKey(key), serialized);
      }
    } catch {
      // Storage full or unavailable — fallback silently
      this.useMemory = true;
      this.memoryFallback.set(this.prefixKey(key), JSON.stringify(value));
    }
  }

  remove(key: string): void {
    try {
      if (this.useMemory) {
        this.memoryFallback.delete(this.prefixKey(key));
      } else {
        localStorage.removeItem(this.prefixKey(key));
      }
    } catch {
      this.memoryFallback.delete(this.prefixKey(key));
    }
  }

  clear(): void {
    try {
      if (this.useMemory) {
        this.memoryFallback.clear();
        return;
      }
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      this.memoryFallback.clear();
    }
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = `${this.prefix}__test__`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}
