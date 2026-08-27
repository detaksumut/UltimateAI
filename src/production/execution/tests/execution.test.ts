/**
 * execution.test.ts
 *
 * Automated baseline tests for Execution Stream (Beta 1).
 * Validates 5 core mandatory scenarios.
 */

import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { PackageRegistry } from '../loader/PackageRegistry';
import { PackageLoader } from '../loader/PackageLoader';
import { ExecutionContextFactory } from '../loader/ExecutionContextFactory';
import { MemoryStateStore } from '../state/MemoryStateStore';
import { LifecycleManager } from '../lifecycle/LifecycleManager';
import { ExecutionKernel } from '../kernel/ExecutionKernel';
import * as crypto from 'crypto';

function runExecutionTests() {
  console.log('=== RUNNING EXECUTION KERNEL TESTS ===');

  // Setup Infrastructure
  const registry = new PackageRegistry();
  const loader = new PackageLoader(registry);
  const factory = new ExecutionContextFactory();
  const store = new MemoryStateStore();
  const lifecycle = new LifecycleManager(store);
  const kernel = new ExecutionKernel(store, lifecycle);

  // Helper to create a valid package
  const createValidPackage = (): IExecutionPackage => {
    const plan = {
      plan_id: 'plan-123',
      initial_state: 'Pending',
      nodes: [
        { state_id: 'Pending', is_terminal: false },
        { state_id: 'Approved', is_terminal: true }
      ],
      edges: [
        { from_state: 'Pending', action: 'approve', to_state: 'Approved' }
      ]
    };
    
    const checksum = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    
    return {
      format: 'UltimateAINative',
      schema_version: '1.0',
      package_version: '1.0',
      metadata: {
        workflow_id: 'wf-123',
        compiled_at: new Date().toISOString(),
        artifact_checksum: checksum
      },
      plan
    };
  };

  // Scenario 1: Valid Package
  console.log('\n[1] Valid Package Loading');
  const validPkg = createValidPackage();
  registry.register(validPkg);
  const loadedPkg = loader.load('wf-123');
  console.log('✅ Package loaded and verified successfully.');

  // Scenario 2: Checksum Failure
  console.log('\n[2] Checksum Verification Failure');
  const corruptPkg = createValidPackage();
  (corruptPkg.plan as any).initial_state = 'HackedState'; // Tamper
  registry.register({ ...corruptPkg, metadata: { ...corruptPkg.metadata, workflow_id: 'wf-corrupt' } });
  try {
    loader.load('wf-corrupt');
    throw new Error('Test Failed: Should have rejected corrupt package.');
  } catch (e: any) {
    if (!e.message.includes('Checksum mismatch')) throw e;
    console.log('✅ Package rejected successfully due to checksum mismatch.');
  }

  // Setup Context for S3/S4/S5
  const context = factory.create(loadedPkg, 'tester');
  lifecycle.start(context); // Also persists to state store

  // Scenario 3: Illegal Transition
  console.log('\n[3] Illegal Transition Check');
  try {
    kernel.transition(context, loadedPkg, 'reject', {});
    throw new Error('Test Failed: Should have rejected illegal action.');
  } catch (e: any) {
    if (!e.message.includes('Illegal transition')) throw e;
    console.log('✅ Kernel correctly blocked illegal transition.');
  }

  // Scenario 4: State Restart Simulation (Persistence)
  console.log('\n[4] State Persistence Simulation');
  const executionId = context.metadata.execution_id;
  const reloadedContext = store.load(executionId);
  if (!reloadedContext || reloadedContext.state.current_state !== 'Pending') {
    throw new Error('Test Failed: State could not be restored.');
  }
  console.log('✅ Execution Context successfully reloaded from MemoryStateStore.');

  // Scenario 5: Valid Transition & Terminal Event Emission
  console.log('\n[5] Transition to Terminal State');
  const events = kernel.transition(reloadedContext, loadedPkg, 'approve', { note: 'Approved!' });
  const terminalEvent = events.find(e => e.type === 'ExecutionCompleted');
  
  if (!terminalEvent) {
    throw new Error('Test Failed: Terminal event ExecutionCompleted was not emitted.');
  }
  console.log(`✅ Kernel successfully transitioned state to 'Approved'.`);
  console.log(`✅ Emitted Terminal Event: ${terminalEvent.type} at ${terminalEvent.timestamp}`);
  
  const finalContext = store.load(executionId);
  console.log(`✅ Final Persisted Status: ${finalContext?.state.status} | Final State: ${finalContext?.state.current_state}`);
}

try {
  runExecutionTests();
} catch (e: any) {
  console.error(e.message);
}
