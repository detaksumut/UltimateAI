/**
 * MemorySnapshotRepository.ts
 *
 * In-memory implementation of ISnapshotRepository.
 */

import { ISnapshotRepository, IExecutionSnapshot } from '../contracts/ISnapshotRepository';

export class MemorySnapshotRepository implements ISnapshotRepository {
  private snapshots = new Map<string, IExecutionSnapshot>();
  
  public save(snapshot: IExecutionSnapshot): void {
    this.snapshots.set(snapshot.execution_id, snapshot);
  }
  
  public load(executionId: string): IExecutionSnapshot | null {
    return this.snapshots.get(executionId) || null;
  }
  
  public listActive(): IExecutionSnapshot[] {
    return Array.from(this.snapshots.values()).filter(
      s => s.context.state.status === 'RUNNING' || s.context.state.status === 'PAUSED'
    );
  }
  
  public delete(executionId: string): void {
    this.snapshots.delete(executionId);
  }
}
