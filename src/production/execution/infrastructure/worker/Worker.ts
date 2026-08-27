/**
 * Worker.ts
 *
 * An autonomous unit that continuously polls the queue and delegates to the Dispatcher.
 */

import { IExecutionQueue } from '../contracts/IExecutionQueue';
import { IJobDispatcher } from '../contracts/IJobDispatcher';
import { IEventDispatcher } from '../../../observability/contracts/IEventDispatcher';
import { randomUUID } from 'crypto';

export class Worker {
  public readonly worker_id: string;
  public status: 'IDLE' | 'BUSY' | 'OFFLINE' = 'IDLE';
  public current_job_id?: string;
  private running = false;
  
  constructor(
    private queue: IExecutionQueue,
    private dispatcher: IJobDispatcher,
    private eventDispatcher: IEventDispatcher
  ) {
    this.worker_id = 'w-' + randomUUID().substring(0, 8);
  }
  
  public start(): void {
    this.running = true;
    this.status = 'IDLE';
    this.eventDispatcher.publish({
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'WorkerStarted',
      execution_id: 'SYSTEM',
      timestamp: new Date().toISOString(),
      payload: { worker_id: this.worker_id }
    });
    
    // Fire and forget loop
    this.poll();
  }
  
  public stop(): void {
    this.running = false;
    this.status = 'OFFLINE';
    this.eventDispatcher.publish({
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'WorkerStopped',
      execution_id: 'SYSTEM',
      timestamp: new Date().toISOString(),
      payload: { worker_id: this.worker_id }
    });
  }
  
  private async poll(): Promise<void> {
    while (this.running) {
      const job = this.queue.dequeue();
      
      if (job) {
        this.status = 'BUSY';
        this.current_job_id = job.job_id;
        
        this.eventDispatcher.publish({
          event_id: randomUUID(),
          event_version: '1.0',
          type: 'JobDequeued',
          execution_id: job.execution_id,
          timestamp: new Date().toISOString(),
          payload: { job_id: job.job_id, worker_id: this.worker_id }
        });
        
        try {
          await this.dispatcher.dispatch(job);
          this.eventDispatcher.publish({
            event_id: randomUUID(),
            event_version: '1.0',
            type: 'JobCompleted',
            execution_id: job.execution_id,
            timestamp: new Date().toISOString(),
            payload: { job_id: job.job_id, worker_id: this.worker_id }
          });
        } catch (error: any) {
          this.eventDispatcher.publish({
            event_id: randomUUID(),
            event_version: '1.0',
            type: 'JobFailed',
            execution_id: job.execution_id,
            timestamp: new Date().toISOString(),
            payload: { job_id: job.job_id, worker_id: this.worker_id, error: error.message }
          });
        }
        
        this.status = 'IDLE';
        this.current_job_id = undefined;
      } else {
        // Sleep if queue is empty
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }
}
