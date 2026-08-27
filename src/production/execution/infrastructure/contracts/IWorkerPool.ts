/**
 * IWorkerPool.ts
 *
 * Defines the contract for a pool of autonomous workers.
 */

export interface IWorkerInfo {
  readonly worker_id: string;
  readonly status: 'IDLE' | 'BUSY' | 'OFFLINE';
  readonly current_job_id?: string;
}

export interface IWorkerPool {
  register(workerId: string): void;
  unregister(workerId: string): void;
  acquire(): string | null; // Returns an available worker_id
  release(workerId: string): void;
  list(): IWorkerInfo[];
}
