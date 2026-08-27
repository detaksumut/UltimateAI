export enum WorkspaceEventType {
  FILE_SAVED = 'FILE_SAVED',
  GIT_COMMIT = 'GIT_COMMIT',
  PULL_REQUEST = 'PULL_REQUEST',
  DB_MIGRATION = 'DB_MIGRATION',
  ADR_CREATED = 'ADR_CREATED',
  TEST_FAILED = 'TEST_FAILED'
}

export interface WorkspaceEvent {
  id: string;
  type: WorkspaceEventType;
  timestamp: number;
  payload: any;
  source: string;
}

export interface EventSubscription {
  id: string;
  unsubscribe: () => void;
}

export class WorkspaceEventBus {
  private listeners: Map<WorkspaceEventType, Array<(event: WorkspaceEvent) => Promise<void>>> = new Map();

  public subscribe(type: WorkspaceEventType, callback: (event: WorkspaceEvent) => Promise<void>): EventSubscription {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);

    return {
      id: Math.random().toString(36).substr(2, 9),
      unsubscribe: () => {
        const callbacks = this.listeners.get(type) || [];
        this.listeners.set(type, callbacks.filter(cb => cb !== callback));
      }
    };
  }

  public async publish(event: WorkspaceEvent): Promise<void> {
    const callbacks = this.listeners.get(event.type) || [];
    // ECR Event Bus ensures sequential, awaited propagation to avoid race conditions in memory updates
    for (const callback of callbacks) {
      await callback(event);
    }
  }
}
