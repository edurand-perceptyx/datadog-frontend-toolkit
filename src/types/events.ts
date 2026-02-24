/** Event types emitted by the SDK */
export enum SDKEvent {
  INITIALIZED = 'sdk:initialized',
  DESTROYED = 'sdk:destroyed',
  ERROR_CAPTURED = 'sdk:error_captured',
  LOG_SENT = 'sdk:log_sent',
  SESSION_STARTED = 'sdk:session_started',
  SESSION_ENDED = 'sdk:session_ended',
  USER_SET = 'sdk:user_set',
  CONTEXT_UPDATED = 'sdk:context_updated',
  CONSENT_GRANTED = 'sdk:consent_granted',
  CONSENT_REVOKED = 'sdk:consent_revoked',
  PERFORMANCE_ENTRY = 'sdk:performance_entry',
  NETWORK_REQUEST = 'sdk:network_request',
  VIEW_CHANGED = 'sdk:view_changed',
  ACTION_TRACKED = 'sdk:action_tracked',
  RESOURCE_PROVISIONED = 'sdk:resource_provisioned',
  PLUGIN_LOADED = 'sdk:plugin_loaded',
  PLUGIN_ERROR = 'sdk:plugin_error',
  THROTTLE_ACTIVATED = 'sdk:throttle_activated',
}

/** Base event payload */
export interface SDKEventPayload {
  type: SDKEvent;
  timestamp: number;
  data?: unknown;
}

/** Error captured event payload */
export interface ErrorCapturedPayload extends SDKEventPayload {
  type: SDKEvent.ERROR_CAPTURED;
  data: {
    error: Error;
    source: 'global' | 'promise' | 'console' | 'network' | 'custom';
    context?: Record<string, unknown>;
    handled: boolean;
  };
}

/** Performance entry payload */
export interface PerformanceEntryPayload extends SDKEventPayload {
  type: SDKEvent.PERFORMANCE_ENTRY;
  data: {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    navigationType?: string;
  };
}

/** Network request payload */
export interface NetworkRequestPayload extends SDKEventPayload {
  type: SDKEvent.NETWORK_REQUEST;
  data: {
    method: string;
    url: string;
    status: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    error?: string;
  };
}

/** Event handler type */
export type EventHandler<T extends SDKEventPayload = SDKEventPayload> = (payload: T) => void;

/** Event emitter interface */
export interface IEventEmitter {
  on<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void;
  off<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void;
  emit<T extends SDKEventPayload>(event: SDKEvent, payload: T): void;
  once<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void;
  removeAllListeners(event?: SDKEvent): void;
}
