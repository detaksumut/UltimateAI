export type ExecutionStatus =
  | "queued"
  | "running"
  | "waiting"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExecutionState {
  readonly requestId: string;
  readonly status: ExecutionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly attempt: number;
  readonly failureReason?: string;
  readonly result?: unknown;
}

/**
 * ExecutionStateStore tracks lifecycle state of every OrchestrationRequest.
 * In-memory implementation — state survives within a session; can be replaced
 * with a persistent adapter (Redis, DB) without changing the interface.
 */
export class ExecutionStateStore {
  private readonly store: Map<string, ExecutionState> = new Map();

  /** Initialize a new request in 'queued' state. */
  init(requestId: string): ExecutionState {
    const state: ExecutionState = {
      requestId,
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempt: 0
    };
    this.store.set(requestId, state);
    return state;
  }

  /** Transition a request to a new status, with optional metadata. */
  transition(
    requestId: string,
    status: ExecutionStatus,
    options: { failureReason?: string; result?: unknown; incrementAttempt?: boolean } = {}
  ): ExecutionState {
    const current = this.store.get(requestId);
    if (!current) throw new Error(`Unknown requestId: ${requestId}`);

    const updated: ExecutionState = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
      attempt: options.incrementAttempt ? current.attempt + 1 : current.attempt,
      failureReason: options.failureReason ?? current.failureReason,
      result: options.result ?? current.result
    };
    this.store.set(requestId, updated);
    return updated;
  }

  get(requestId: string): ExecutionState | undefined {
    return this.store.get(requestId);
  }

  getAll(): ExecutionState[] {
    return Array.from(this.store.values());
  }

  getByStatus(status: ExecutionStatus): ExecutionState[] {
    return this.getAll().filter(s => s.status === status);
  }

  /** Check if a request has been cancelled — used to abort mid-execution. */
  isCancelled(requestId: string): boolean {
    return this.store.get(requestId)?.status === "cancelled";
  }
}
