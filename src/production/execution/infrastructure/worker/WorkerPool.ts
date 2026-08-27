/**
 * WorkerPool.ts
 *
 * Manages the lifecycle of multiple Workers.
 */

import { IWorkerPool, IWorkerInfo } from '../contracts/IWorkerPool';
import { Worker } from './Worker';
import { IExecutionQueue } from '../contracts/IExecutionQueue';
import { IJobDispatcher } from '../contracts/IJobDispatcher';
import { IEventDispatcher } from '../../../observability/contracts/IEventDispatcher';

export class WorkerPool implements IWorkerPool {
  private workers = new Map<string, Worker>();
  
  constructor(
    private queue: IExecutionQueue,
    private dispatcher: IJobDispatcher,
    private eventDispatcher: IEventDispatcher,
    poolSize: number = 2
  ) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(queue, dispatcher, eventDispatcher);
      this.workers.set(worker.worker_id, worker);
    }
  }
  
  public startAll(): void {
    for (const worker of this.workers.values()) {
      worker.start();
    }
  }
  
  public stopAll(): void {
    for (const worker of this.workers.values()) {
      worker.stop();
    }
  }
  
  public register(workerId: string): void {
    // In a multi-node setup, this tracks external workers. For single-node Beta 4, ignored.
  }
  
  public unregister(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.stop();
      this.workers.delete(workerId);
    }
  }
  
  public acquire(): string | null {
    // For single-node Beta 4, workers pull autonomously. 
    // This contract exists for future PUSH models or load balancers.
    for (const [id, worker] of this.workers.entries()) {
      if (worker.status === 'IDLE') return id;
    }
    return null;
  }
  
  public release(workerId: string): void {
    // No-op for Beta 4, handled autonomously by Worker.ts
  }
  
  public list(): IWorkerInfo[] {
    return Array.from(this.workers.values()).map(w => ({
      worker_id: w.worker_id,
      status: w.status,
      current_job_id: w.current_job_id
    }));
  }
}
