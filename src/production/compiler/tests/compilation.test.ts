/**
 * compilation.test.ts
 *
 * Automated test for the Compilation Domain (End-to-End).
 * Proves Analysis Gate interception and Native Package roundtrip equivalence.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';
import { IAutomationManifest } from '../../automation/contracts/IAutomationManifest';
import { ICompilationContext } from '../contracts/ICompilationContext';
import { CompilationPlanner } from '../core/CompilationPlanner';
import { NativePackageAdapter } from '../adapters/NativePackageAdapter';

function runCompilationTest() {
  console.log('=== RUNNING COMPILATION DOMAIN TEST ===');

  const dirtyModel: IWorkflowModel = {
    id: 'test-wf-001',
    version: '1.0',
    trigger: { event: 'todo.created' },
    states: ['Pending', 'OrphanState', 'Approved'], // OrphanState triggers WF001
    actions: ['approve'],
    transitions: [
      { from: 'Pending', action: 'approve', to: 'Approved' }
    ]
  };

  const manifest: IAutomationManifest = {
    business: {
      manifest_id: 'm-123',
      workflow_id: 'test-wf-001',
      workflow_model_version: '1.0',
      generator_version: '1.0',
      schema_version: '1.0',
      created_at: new Date().toISOString(),
      domain: 'todo',
      owner: 'sysadmin',
      visibility: 'private'
    },
    operational: {
      runtime: 'native'
    }
  };

  const planner = new CompilationPlanner();
  const strategy = planner.plan(manifest);

  // 1. First Pass Context (Dirty Model)
  const context1: ICompilationContext = {
    manifest,
    workflow_model: dirtyModel,
    diagnostics: { status: 'PENDING', messages: [] }
  };

  console.log('\n[1] Testing AnalysisGate Interception (Dirty Model)...');
  const report1 = strategy.passManager.run(context1);
  
  if (report1.diagnostics_status !== 'FAIL') {
    throw new Error('Test Failed: AnalysisGate should have aborted compilation due to WF001 (Dead State).');
  }
  console.log('✅ AnalysisGate successfully aborted compilation.');
  console.log(`Diagnostics: ${report1.diagnostic_messages.join(' ')}`);

  // 2. Second Pass Context (Clean Model)
  const cleanModel: IWorkflowModel = {
    ...dirtyModel,
    states: ['Pending', 'Approved'] // Cleaned
  };

  const context2: ICompilationContext = {
    manifest,
    workflow_model: cleanModel,
    diagnostics: { status: 'PENDING', messages: [] }
  };

  console.log('\n[2] Testing Full Compilation Pipeline (Clean Model)...');
  const report2 = strategy.passManager.run(context2);

  if (report2.diagnostics_status === 'FAIL') {
    throw new Error('Test Failed: Clean model compilation was aborted.');
  }

  if (!report2.artifact) {
    throw new Error('Test Failed: Compilation artifact was not generated.');
  }
  
  console.log('✅ Compilation succeeded.');
  console.log(`Artifact Checksum: ${report2.artifact_checksum}`);
  console.log(`Executed Passes: ${report2.passes_executed.join(' -> ')}`);

  // 3. Adapter Phase (Native Roundtrip)
  console.log('\n[3] Testing Target Adapter & Roundtrip Equivalence...');
  const nativePackage = strategy.adapter.adapt(report2.artifact);
  
  console.log(`Generated Native Package: ${nativePackage.format} v${nativePackage.package_version}`);
  
  // Simulate loading the package back into a model
  const loadedModel = nativePackage.workflow;
  
  // Verify equivalence (after StructuralCleanupPass has normalized it)
  // CleanModel is already canonical, so they should match perfectly.
  const stringifiedLoaded = JSON.stringify(loadedModel);
  const stringifiedContext = JSON.stringify(context2.workflow_model); // The model mutated by StructuralCleanupPass
  
  if (stringifiedLoaded !== stringifiedContext) {
    console.error('Loaded:', stringifiedLoaded);
    console.error('Context:', stringifiedContext);
    throw new Error('Test Failed: Native Package Roundtrip violation.');
  }
  
  console.log('✅ TEST PASSED: Native Package roundtrip is perfectly equivalent (Lossless).');
}

try {
  runCompilationTest();
} catch (e: any) {
  console.error(e.message);
}
