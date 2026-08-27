import { RequestPriority, ResourceBudget } from "./ExecutionScheduler";
import { ScheduledRequest } from "./ExecutionScheduler";

/**
 * IScheduler — Scheduler interface that makes no single-node assumptions.
 * ExecutionScheduler (in-memory) and future distributed implementations
 * must both satisfy this contract.
 */
export interface IScheduler {
  enqueue(
    requestId: string,
    priority?: RequestPriority,
    budget?: Partial<ResourceBudget>
  ): ScheduledRequest;

  dequeue(): ScheduledRequest | undefined;

  cancel(requestId: string): boolean;

  isCancelled(requestId: string): boolean;

  queueLength(): number;

  peek(): ScheduledRequest | undefined;

  getQueueSnapshot(): ScheduledRequest[];
}
