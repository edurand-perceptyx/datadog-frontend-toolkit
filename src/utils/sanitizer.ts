const DEFAULT_PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // phone numbers
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // credit cards
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
];

const DEFAULT_SENSITIVE_KEYS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
  'authorization', 'auth', 'credential', 'private_key', 'privatekey',
  'access_token', 'refresh_token', 'ssn', 'credit_card', 'creditcard',
  'cvv', 'pin', 'otp',
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 10;
const MAX_STRING_LENGTH = 10000;
const MAX_ARRAY_LENGTH = 100;

export class Sanitizer {
  private readonly piiPatterns: RegExp[];
  private readonly sensitiveKeys: Set<string>;
  private readonly maxDepth: number;
  private readonly maxStringLength: number;

  constructor(
    piiFields: string[] = [],
    maxDepth: number = MAX_DEPTH,
    maxStringLength: number = MAX_STRING_LENGTH,
  ) {
    this.sensitiveKeys = new Set([
      ...DEFAULT_SENSITIVE_KEYS,
      ...piiFields.map((f) => f.toLowerCase()),
    ]);
    this.piiPatterns = [...DEFAULT_PII_PATTERNS];
    this.maxDepth = maxDepth;
    this.maxStringLength = maxStringLength;
  }

  sanitize<T>(data: T): T {
    return this.deepSanitize(data, 0, new WeakSet()) as T;
  }

  sanitizeString(value: string): string {
    let result = value;
    for (const pattern of this.piiPatterns) {
      const cloned = new RegExp(pattern.source, pattern.flags);
      result = result.replace(cloned, REDACTED);
    }
    return this.truncateString(result);
  }

  private deepSanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (depth > this.maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return this.sanitizeError(value, depth, seen);
    }

    if (Array.isArray(value)) {
      const limited = value.slice(0, MAX_ARRAY_LENGTH);
      return limited.map((item) => this.deepSanitize(item, depth + 1, seen));
    }

    if (typeof value === 'object') {
      if (seen.has(value as object)) {
        return '[CIRCULAR_REFERENCE]';
      }
      seen.add(value as object);

      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = REDACTED;
        } else {
          sanitized[key] = this.deepSanitize(val, depth + 1, seen);
        }
      }
      return sanitized;
    }

    return String(value);
  }

  private sanitizeError(
    error: Error,
    depth: number,
    seen: WeakSet<object>,
  ): Record<string, unknown> {
    return {
      name: error.name,
      message: this.sanitizeString(error.message),
      stack: error.stack ? this.sanitizeString(error.stack) : undefined,
      cause: error.cause ? this.deepSanitize(error.cause, depth + 1, seen) : undefined,
    };
  }

  private isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase();
    return this.sensitiveKeys.has(lower) || this.sensitiveKeys.has(lower.replace(/[-_]/g, ''));
  }

  private truncateString(value: string): string {
    if (value.length <= this.maxStringLength) {
      return value;
    }
    return value.substring(0, this.maxStringLength) + `... [truncated, total: ${value.length}]`;
  }
}
