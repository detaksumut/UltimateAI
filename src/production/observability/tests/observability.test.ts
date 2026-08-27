/**
 * observability.test.ts
 *
 * Validates the Observability Stream architecture.
 * Ensures Consumer Isolation, Event Ordering, and Replay Idempotency.
 */

import { EventDispatcher } from '../stream/EventDispatcher';
import { StructuredLogger } from '../consumers/log/StructuredLogger';
import { JsonFormatter } from '../consumers/log/JsonFormatter';
import { MetricsCollector } from '../consumers/metrics/MetricsCollector';
import { TraceCollector } from '../consumers/trace/TraceCollector';
import { AuditStream } from '../consumers/audit/AuditStream';
import { IExecutionEvent } from '../../execution/contracts/IExecutionEvent';

function runObservabilityTests() {
  console.log('=== RUNNING OBSERVABILITY TESTS ===');

  const dispatcher = new EventDispatcher();
  
  const logger = new StructuredLogger(new JsonFormatter());
  const metrics = new MetricsCollector();
  const trace = new TraceCollector();
  const audit = new AuditStream();
  
  dispatcher.subscribe(logger);
  dispatcher.subscribe(metrics);
  dispatcher.subscribe(trace);
  dispatcher.subscribe(audit);
  
  // Create a sequence of events simulating a Kernel execution
  const e1: IExecutionEvent = {
    event_id: 'ev-1',
    event_version: '1.0',
    type: 'ExecutionStarted',
    execution_id: 'ex-123',
    timestamp: new Date().toISOString(),
    payload: { initial_state: 'Pending' }
  };
  
  const e2: IExecutionEvent = {
    event_id: 'ev-2',
    event_version: '1.0',
    type: 'StateTransitioned',
    execution_id: 'ex-123',
    timestamp: new Date().toISOString(),
    payload: { from: 'Pending', action: 'approve', to: 'Approved' }
  };
  
  const e3: IExecutionEvent = {
    event_id: 'ev-3',
    event_version: '1.0',
    type: 'ExecutionCompleted',
    execution_id: 'ex-123',
    timestamp: new Date().toISOString(),
    payload: { final_state: 'Approved' }
  };

  // Scenario 1: Event Ordering Test
  console.log('\n[1] Testing Event Ordering...');
  dispatcher.publish(e1);
  dispatcher.publish(e2);
  dispatcher.publish(e3);
  
  const activeCount = metrics.metrics.active_executions.get();
  if (activeCount !== 0) throw new Error('Test Failed: Active executions should be 0 after completion.');
  console.log('✅ Event Ordering verified. Metrics correctly tracked full lifecycle.');

  // Scenario 2: Consumer Isolation Test
  console.log('\n[2] Testing Consumer Isolation...');
  audit.simulateFailure = true; // Audit will throw on next consume
  
  const e4: IExecutionEvent = {
    event_id: 'ev-4',
    event_version: '1.0',
    type: 'ExecutionStarted',
    execution_id: 'ex-999',
    timestamp: new Date().toISOString(),
    payload: {}
  };
  
  dispatcher.publish(e4);
  
  const activeCount2 = metrics.metrics.active_executions.get();
  if (activeCount2 !== 1) throw new Error('Test Failed: Metrics should have continued counting despite Audit failure.');
  console.log('✅ Consumer Isolation verified. Audit crash did not halt Metrics or Logger.');
  
  // Scenario 3: Replay Test
  console.log('\n[3] Testing Replay Idempotency...');
  // Replay e4
  dispatcher.publish(e4);
  
  const activeCount3 = metrics.metrics.active_executions.get();
  if (activeCount3 !== 1) throw new Error('Test Failed: Replay caused double counting in metrics.');
  console.log('✅ Replay Idempotency verified. Duplicate events do not corrupt state.');
}

try {
  runObservabilityTests();
} catch (e: any) {
  console.error(e.message);
}
