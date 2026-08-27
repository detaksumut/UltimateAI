/**
 * IExecutionQueue.ts
 *
 * Defines the contract for an Execution Queue.
 * Workers pull from this interface.
 */

export interface IExecutionJob {
  readonly job_id: string;
  readonly execution_id: string;
  readonly workflow_id: string;
  readonly payload: any;
  readonly enqueued_at: string;
  readonly priority: number;
}

export interface IExecutionQueue {
  enqueue(job: Omit<IExecutionJob, 'job_id' | 'enqueued_at'>): IExecutionJob;
  dequeue(): IExecutionJob | null;
  peek(): IExecutionJob | null;
  size(): number;
  clear(): void;
}
