import { LogLevel } from './config';

/** Structured log entry */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Service name */
  service: string;
  /** Environment */
  env: string;
  /** Application version */
  version: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error object if applicable */
  error?: SerializedError;
  /** Browser/device info */
  browser?: BrowserInfo;
  /** Current page URL */
  url?: string;
  /** View/route name */
  view?: string;
  /** Session ID */
  sessionId?: string;
  /** User context */
  user?: Record<string, unknown>;
  /** Stack trace fingerprint */
  fingerprint?: string;
  /** Tags */
  tags?: string[];
}

/** Serialized error for transport */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError;
  type: string;
  fingerprint: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
}

/** Browser and device information */
export interface BrowserInfo {
  userAgent: string;
  language: string;
  platform: string;
  vendor: string;
  cookieEnabled: boolean;
  online: boolean;
  screenResolution: string;
  viewportSize: string;
  devicePixelRatio: number;
  colorDepth: number;
  timezone: string;
  memory?: MemoryInfo;
  connection?: ConnectionInfo;
}

/** Memory information (if available) */
export interface MemoryInfo {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
}

/** Network connection information */
export interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/** Logger transport interface for extensibility */
export interface LogTransport {
  name: string;
  send(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
}

/** Log formatter interface */
export interface LogFormatter {
  format(entry: LogEntry): string | Record<string, unknown>;
}

/** Logger configuration */
export interface LoggerConfig {
  /** Minimum level to log */
  minLevel: LogLevel;
  /** Enable console output */
  consoleOutput: boolean;
  /** Custom transports */
  transports?: LogTransport[];
  /** Custom formatter */
  formatter?: LogFormatter;
  /** Max context depth for serialization */
  maxContextDepth?: number;
  /** Max string length in context values */
  maxStringLength?: number;
}

/** Log level numeric values for comparison */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.CRITICAL]: 4,
};
