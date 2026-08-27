/**
 * infrastructure.test.ts
 *
 * Validates Beta 4 (Execution Infrastructure) Resiliency mechanics.
 */

import { MemoryExecutionQueue } from '../queue/MemoryExecutionQueue';
import { WorkerPool } from '../worker/WorkerPool';
import { MemorySnapshotRepository } from '../recovery/MemorySnapshotRepository';
import { SnapshotValidator } from '../recovery/SnapshotValidator';
import { RecoveryPlanner, RecoveryManager } from '../recovery/RecoveryManager';
import { EventDispatcher } from '../../../observability/stream/EventDispatcher';
import { JobDispatcher } from '../dispatcher/JobDispatcher';
import { IExecutionSnapshot } from '../contracts/ISnapshotRepository';

async function runInfrastructureTests() {
  console.log('=== RUNNING INFRASTRUCTURE TESTS ===');

  const dispatcher = new EventDispatcher();
  const queue = new MemoryExecutionQueue();
  const repo = new MemorySnapshotRepository();
  const validator = new SnapshotValidator();
  const planner = new RecoveryPlanner(queue);
  const recoveryManager = new RecoveryManager(repo, validator, planner);
  
  // Create mock JobDispatcher
  const mockJobDispatcher = {
    dispatch: async (job: any) => {
      // Simulate work
    }
  } as any;
  
  const workerPool = new WorkerPool(queue, mockJobDispatcher, dispatcher, 2);

  // Scenario 1: Queue Ordering
  console.log('\n[1] Testing Queue Ordering (Priority & FIFO)...');
  queue.enqueue({ execution_id: 'ex-1', workflow_id: 'wf-1', payload: {}, priority: 10 });
  queue.enqueue({ execution_id: 'ex-2', workflow_id: 'wf-1', payload: {}, priority: 1 }); // Higher priority
  queue.enqueue({ execution_id: 'ex-3', workflow_id: 'wf-1', payload: {}, priority: 10 });
  
  const j1 = queue.dequeue();
  const j2 = queue.dequeue();
  const j3 = queue.dequeue();
  
  if (j1?.execution_id !== 'ex-2' || j2?.execution_id !== 'ex-1' || j3?.execution_id !== 'ex-3') {
    throw new Error('Test Failed: Queue ordering violated.');
  }
  console.log('✅ Queue Ordering (Priority & FIFO) strictly maintained.');

  // Scenario 2: Worker Recovery & Lifecycles
  console.log('\n[2] Testing Worker Pool Lifecycle...');
  workerPool.startAll();
  const activeWorkers = workerPool.list().filter(w => w.status !== 'OFFLINE');
  if (activeWorkers.length !== 2) throw new Error('Test Failed: WorkerPool failed to start workers.');
  workerPool.stopAll();
  console.log('✅ WorkerPool autonomously managed lifecycles.');

  // Scenario 3: Snapshot Corruption Rejection
  console.log('\n[3] Testing Snapshot Corruption...');
  repo.save({
    execution_id: 'corrupt-1',
    context: null as any // Corrupt context
  } as IExecutionSnapshot);
  
  recoveryManager.executeRecovery();
  if (queue.size() > 0) throw new Error('Test Failed: RecoveryManager queued a corrupt snapshot.');
  console.log('✅ RecoveryManager successfully blocked corrupt snapshot.');
  repo.delete('corrupt-1');

  // Scenario 4: Recovery Mechanics & Duplicate Prevention
  console.log('\n[4] Testing System Recovery & Idempotency...');
  const validSnapshot: IExecutionSnapshot = {
    snapshot_id: 'snap-1',
    snapshot_version: '1.0',
    execution_id: 'ex-recovered',
    timestamp: new Date().toISOString(),
    context: {
      metadata: { workflow_id: 'wf-2' },
      state: { status: 'RUNNING' }
    } as any
  };
  
  repo.save(validSnapshot);
  
  // First Recovery
  recoveryManager.executeRecovery();
  if (queue.size() !== 1) throw new Error('Test Failed: Valid snapshot was not recovered.');
  
  // Duplicate Recovery (simulate another crash/restart loop quickly)
  recoveryManager.executeRecovery();
  if (queue.size() !== 1) throw new Error('Test Failed: Duplicate recovery occurred.');
  console.log('✅ RecoveryManager successfully requeued RUNNING execution and prevented duplicate recovery.');

  // Scenario 5: Queue Drain
  console.log('\n[5] Testing Queue Drain (Shutdown)...');
  queue.clear();
  if (queue.size() !== 0) throw new Error('Test Failed: Queue drain failed.');
  console.log('✅ Execution Queue drained successfully.');
}

try {
  runInfrastructureTests().catch(console.error);
} catch (e: any) {
  console.error(e.message);
}
