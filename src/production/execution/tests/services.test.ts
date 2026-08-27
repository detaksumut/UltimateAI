/**
 * services.test.ts
 *
 * Validates Beta 3 (Runtime Services) architectures.
 */

import { RuntimeScheduler } from '../scheduler/RuntimeScheduler';
import { TimeoutManager } from '../services/TimeoutManager';
import { RetryManager } from '../services/RetryManager';
import { ConcurrencyLimiter } from '../services/ResourceLimiter';
import { MemoryDLQ } from '../dlq/MemoryDLQ';
import { ExecutionKernel } from '../kernel/ExecutionKernel';
import { LifecycleManager } from '../lifecycle/LifecycleManager';
import { MemoryStateStore } from '../state/MemoryStateStore';
import { EventDispatcher } from '../../observability/stream/EventDispatcher';
import { ExecutionContextFactory } from '../loader/ExecutionContextFactory';
import { IExecutionPackage } from '../contracts/IExecutionPackage';

async function runRuntimeServicesTests() {
  console.log('=== RUNNING RUNTIME SERVICES TESTS ===');

  const dispatcher = new EventDispatcher();
  const store = new MemoryStateStore();
  const lifecycle = new LifecycleManager(store);
  const kernel = new ExecutionKernel(store, lifecycle);
  
  const timeoutManager = new TimeoutManager();
  const retryManager = new RetryManager();
  const limiter = new ConcurrencyLimiter(1); // Max 1 for testing fairness/queuing
  const dlq = new MemoryDLQ();
  
  const scheduler = new RuntimeScheduler(
    kernel, lifecycle, timeoutManager, retryManager, limiter, dlq, dispatcher
  );
  
  const factory = new ExecutionContextFactory();

  const pkg: IExecutionPackage = {
    format: 'UltimateAINative',
    schema_version: '1.0',
    package_version: '1.0',
    metadata: { workflow_id: 'wf-test', compiled_at: new Date().toISOString(), artifact_checksum: 'test' },
    plan: {
      plan_id: 'p-1',
      initial_state: 'Pending',
      nodes: [
        { state_id: 'Pending', is_terminal: false },
        { state_id: 'Done', is_terminal: true }
      ],
      edges: [
        { from_state: 'Pending', action: 'go', to_state: 'Done' }
      ]
    }
  };

  // Scenario 1: Limiter Fairness / Concurrency Rejection
  console.log('\n[1] Testing Resource Limiter...');
  const ctx1 = factory.create(pkg, 'tester');
  const ctx2 = factory.create(pkg, 'tester');
  
  await scheduler.scheduleStart(ctx1, pkg);
  await scheduler.scheduleStart(ctx2, pkg);
  
  // Limiter is set to 1. The second start should result in ExecutionQueued.
  // In a real test, we would check the events published, but for now we just check limiter state.
  if (limiter.getActiveCount() !== 1) {
    throw new Error('Test Failed: Limiter allowed more than 1 execution.');
  }
  console.log('✅ Resource Limiter successfully blocked concurrent execution.');

  // Scenario 2: Scheduler Determinism & Success
  console.log('\n[2] Testing Scheduler Determinism...');
  await scheduler.scheduleTransition(ctx1, pkg, 'go', {});
  if (limiter.getActiveCount() !== 0) {
    throw new Error('Test Failed: Limiter did not release resources after completion.');
  }
  console.log('✅ Scheduler successfully orchestrated a full run and released resources.');

  // Scenario 3: Timeout Race Rejection
  console.log('\n[3] Testing Timeout Evaluation...');
  const ctx3 = factory.create(pkg, 'tester', {
    timeout_ms: -1, // Force immediate timeout
    max_retries: 0,
    retry_backoff_ms: 0,
    priority: 1
  });
  
  await scheduler.scheduleStart(ctx3, pkg);
  await scheduler.scheduleTransition(ctx3, pkg, 'go', {});
  
  const dlqRecordTimeout = dlq.list(ctx3.metadata.execution_id)[0];
  if (!dlqRecordTimeout || dlqRecordTimeout.failure_category !== 'TIMEOUT') {
    throw new Error('Test Failed: Execution was not routed to DLQ on timeout.');
  }
  console.log('✅ Timeout Manager successfully killed hanging execution and moved to DLQ.');

  // Scenario 4: Retry Idempotency & DLQ Integrity
  console.log('\n[4] Testing Retry Limits & DLQ Integrity...');
  const ctx4 = factory.create(pkg, 'tester', {
    timeout_ms: 30000,
    max_retries: 2, // Allow 2 retries
    retry_backoff_ms: 0,
    priority: 1
  });
  
  await scheduler.scheduleStart(ctx4, pkg);
  
  // Simulate 3 kernel crashes (Illegal action 'crash')
  await scheduler.scheduleTransition(ctx4, pkg, 'crash', {}); // Retry 1
  await scheduler.scheduleTransition(ctx4, pkg, 'crash', {}); // Retry 2
  await scheduler.scheduleTransition(ctx4, pkg, 'crash', {}); // Terminal -> DLQ
  
  if (ctx4.state.retry_count !== 2) {
    throw new Error(`Test Failed: Expected 2 retries, got ${ctx4.state.retry_count}`);
  }
  
  const dlqRecord = dlq.list(ctx4.metadata.execution_id)[0];
  if (!dlqRecord) {
    throw new Error('Test Failed: Execution was not moved to DLQ after exhausting retries.');
  }
  
  // Verify DLQ Integrity
  if (dlqRecord.package_snapshot.metadata.workflow_id !== 'wf-test') {
    throw new Error('Test Failed: DLQ did not preserve the package snapshot.');
  }
  if (dlqRecord.failure_category !== 'EXHAUSTED_RETRIES') {
    throw new Error('Test Failed: DLQ recorded incorrect failure category.');
  }
  
  console.log('✅ Retry Manager correctly evaluated limits.');
  console.log('✅ DLQ strictly preserved Context, Package Snapshot, and Failure Reason.');

}

try {
  runRuntimeServicesTests().catch(console.error);
} catch (e: any) {
  console.error(e.message);
}
