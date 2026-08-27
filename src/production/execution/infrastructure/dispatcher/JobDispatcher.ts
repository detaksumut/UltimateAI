/**
 * JobDispatcher.ts
 *
 * Middle layer routing jobs from Worker to RuntimeScheduler.
 */

import { IJobDispatcher } from '../contracts/IJobDispatcher';
import { IExecutionJob } from '../contracts/IExecutionQueue';
import { RuntimeScheduler } from '../../scheduler/RuntimeScheduler';
import { PackageLoader } from '../../loader/PackageLoader';
import { ExecutionContextFactory } from '../../loader/ExecutionContextFactory';
import { MemoryStateStore } from '../../state/MemoryStateStore';

export class JobDispatcher implements IJobDispatcher {
  constructor(
    private scheduler: RuntimeScheduler,
    private loader: PackageLoader,
    private factory: ExecutionContextFactory,
    private stateStore: MemoryStateStore // Simplified access to state
  ) {}
  
  public async dispatch(job: IExecutionJob): Promise<void> {
    const pkg = this.loader.load(job.workflow_id);
    
    if (job.payload.action === 'START') {
      // Create new execution context
      const context = this.factory.create(pkg, 'worker');
      context.metadata = { ...context.metadata, execution_id: job.execution_id }; // Override with job's exec id
      await this.scheduler.scheduleStart(context, pkg);
    } else {
      // Transition an existing execution
      const context = this.stateStore.load(job.execution_id);
      if (!context) throw new Error(`JobDispatcher Error: Execution ${job.execution_id} not found.`);
      await this.scheduler.scheduleTransition(context, pkg, job.payload.action, job.payload.data || {});
    }
  }
}
