/**
 * MemoryExecutionQueue.ts
 *
 * In-memory implementation of IExecutionQueue. Basic FIFO.
 */

import { IExecutionQueue, IExecutionJob } from './contracts/IExecutionQueue';
import { randomUUID } from 'crypto';

export class MemoryExecutionQueue implements IExecutionQueue {
  private queue: IExecutionJob[] = [];
  
  public enqueue(job: Omit<IExecutionJob, 'job_id' | 'enqueued_at'>): IExecutionJob {
    const fullJob: IExecutionJob = {
      ...job,
      job_id: randomUUID(),
      enqueued_at: new Date().toISOString()
    };
    
    // Simplistic priority insertion: higher priority (lower number) goes first.
    // E.g., priority 1 is before priority 10.
    const insertIndex = this.queue.findIndex(j => j.priority > fullJob.priority);
    if (insertIndex === -1) {
      this.queue.push(fullJob);
    } else {
      this.queue.splice(insertIndex, 0, fullJob);
    }
    
    return fullJob;
  }
  
  public dequeue(): IExecutionJob | null {
    return this.queue.shift() || null;
  }
  
  public peek(): IExecutionJob | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }
  
  public size(): number {
    return this.queue.length;
  }
  
  public clear(): void {
    this.queue = [];
  }
}
