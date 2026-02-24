import type { SDKEvent, SDKEventPayload, EventHandler, IEventEmitter } from '../types/events';

/**
 * Type-safe event emitter for SDK lifecycle events.
 * Implements the Observer pattern for loose coupling between modules.
 */
export class EventEmitter implements IEventEmitter {
  private listeners: Map<SDKEvent, Set<EventHandler>> = new Map();

  on<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
  }

  off<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  emit<T extends SDKEventPayload>(event: SDKEvent, payload: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        // Prevent listener errors from breaking the SDK
      }
    }
  }

  once<T extends SDKEventPayload>(event: SDKEvent, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = (payload) => {
      this.off(event, wrappedHandler);
      handler(payload);
    };
    this.on(event, wrappedHandler);
  }

  removeAllListeners(event?: SDKEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
