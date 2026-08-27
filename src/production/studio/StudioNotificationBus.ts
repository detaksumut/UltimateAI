export type StudioNotificationEvent =
  | "GenerationStarted"
  | "GenerationCompleted"
  | "GenerationFailed"
  | "GenerationCancelled";

export interface StudioNotification {
  readonly notificationId: string;
  readonly event: StudioNotificationEvent;
  readonly requestId: string;
  readonly emittedAt: string;
  readonly payload?: unknown;
}

type NotificationHandler = (notification: StudioNotification) => void;

let _notifCounter = 0;

/**
 * StudioNotificationBus — event-based notification system for Studio.
 * Enables UI components to react to generation lifecycle events
 * without polling, by registering handlers on named events.
 */
export class StudioNotificationBus {
  private readonly handlers: Map<StudioNotificationEvent | "*", NotificationHandler[]> = new Map();
  private readonly log: StudioNotification[] = [];

  on(event: StudioNotificationEvent | "*", handler: NotificationHandler): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler]);
  }

  off(event: StudioNotificationEvent | "*", handler: NotificationHandler): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, existing.filter(h => h !== handler));
  }

  emit(event: StudioNotificationEvent, requestId: string, payload?: unknown): void {
    const notification: StudioNotification = {
      notificationId: `notif-${++_notifCounter}`,
      event,
      requestId,
      emittedAt: new Date().toISOString(),
      payload
    };
    this.log.push(notification);
    (this.handlers.get(event) ?? []).forEach(h => h(notification));
    (this.handlers.get("*") ?? []).forEach(h => h(notification));
  }

  getLog(requestId?: string): StudioNotification[] {
    if (!requestId) return [...this.log];
    return this.log.filter(n => n.requestId === requestId);
  }
}
