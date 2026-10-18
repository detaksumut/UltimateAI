/**
 * SchedulerTypes.ts
 * Shared scheduler contract types, extracted from ExecutionScheduler to break
 * the ExecutionScheduler ↔ IScheduler circular dependency (dependency-cruiser
 * no-circular). Both the IScheduler interface and ExecutionScheduler (and other
 * consumers) import these from this leaf module.
 */

export type RequestPriority = "high" | "normal" | "low";

export interface ResourceBudget {
  /** Maximum total execution time in milliseconds. */
  readonly maxTimeMs: number;
  /** Maximum memory allowed in megabytes (advisory; enforced by Orchestrator). */
  readonly maxMemoryMb: number;
}

export interface ScheduledRequest {
  readonly requestId: string;
  readonly priority: RequestPriority;
  readonly queuedAt: string;
  readonly resourceBudget: ResourceBudget;
}
