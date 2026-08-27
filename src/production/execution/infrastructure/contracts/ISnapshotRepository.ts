/**
 * ExecutionSnapshot.ts & ISnapshotRepository.ts
 *
 * Defines the distinct Snapshot Artifact and its storage contract.
 */

import { IExecutionContext } from '../../contracts/IExecutionContext';
import { IRuntimeDecision } from '../../contracts/IRuntimeDecision';

export interface IExecutionSnapshot {
  readonly snapshot_id: string;
  readonly snapshot_version: string;
  readonly execution_id: string;
  readonly timestamp: string;
  
  readonly context: IExecutionContext;
  readonly last_decision?: IRuntimeDecision;
}

export interface ISnapshotRepository {
  save(snapshot: IExecutionSnapshot): void;
  load(executionId: string): IExecutionSnapshot | null;
  listActive(): IExecutionSnapshot[]; // Find executions that were RUNNING/PAUSED
  delete(executionId: string): void;
}
