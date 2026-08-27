/**
 * RecoveryPlanner.ts & RecoveryManager.ts
 *
 * Evaluates valid snapshots and re-queues them.
 * RecoveryManager orchestrates the recovery pipeline.
 */

import { ISnapshotRepository } from '../contracts/ISnapshotRepository';
import { IExecutionQueue } from '../contracts/IExecutionQueue';
import { SnapshotValidator } from './SnapshotValidator';

export class RecoveryPlanner {
  constructor(private queue: IExecutionQueue) {}
  
  public planAndQueue(snapshot: any): void {
    // Re-queue the pending transition.
    // For Beta 4, we assume we resume by sending a 'RESUME' action or just picking up where we left off.
    this.queue.enqueue({
      execution_id: snapshot.execution_id,
      workflow_id: snapshot.context.metadata.workflow_id,
      payload: { action: 'RESUME', from_recovery: true },
      priority: 0 // Highest priority for recovery
    });
  }
}

export class RecoveryManager {
  private executedRecoveries = new Set<string>(); // Prevent duplicate recovery
  
  constructor(
    private repository: ISnapshotRepository,
    private validator: SnapshotValidator,
    private planner: RecoveryPlanner
  ) {}
  
  public executeRecovery(): void {
    const activeSnapshots = this.repository.listActive();
    
    for (const snapshot of activeSnapshots) {
      if (this.executedRecoveries.has(snapshot.execution_id)) {
        console.warn(`[RecoveryManager] Skipping duplicate recovery for ${snapshot.execution_id}`);
        continue;
      }
      
      if (this.validator.validate(snapshot)) {
        this.planner.planAndQueue(snapshot);
        this.executedRecoveries.add(snapshot.execution_id);
      } else {
        console.error(`[RecoveryManager] Snapshot for ${snapshot.execution_id} is corrupt. Abandoning recovery.`);
        // Could move to DLQ here
      }
    }
  }
}
