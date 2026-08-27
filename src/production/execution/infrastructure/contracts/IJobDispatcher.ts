/**
 * IJobDispatcher.ts
 *
 * The middle layer between Worker and Scheduler.
 * Handles job routing, delayed jobs, and retries natively.
 */

import { IExecutionJob } from './IExecutionQueue';

export interface IJobDispatcher {
  dispatch(job: IExecutionJob): Promise<void>;
}
