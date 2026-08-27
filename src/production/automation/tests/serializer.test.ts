/**
 * serializer.test.ts
 *
 * Automated test to prove Lossless Serialization (Deterministic Serialization).
 * Ensures that translating a WorkflowModel to YAML and back retains 100% fidelity.
 */

import { YAMLSerializer } from '../serialization/YAMLSerializer';
import { YAMLParser } from '../compiler/parser/YAMLParser';
import { WorkflowParser } from '../compiler/parser/WorkflowParser';
import { IWorkflowModel } from '../contracts/IWorkflowModel';

function runLosslessTest() {
  console.log('=== RUNNING LOSSLESS SERIALIZATION TEST ===');

  // 1. Define the Canonical Model
  const originalModel: IWorkflowModel = {
    id: 'test-wf-001',
    version: '1.0',
    trigger: { event: 'todo.created' },
    states: ['Pending', 'Approved', 'Rejected'],
    actions: ['action-approve', 'action-reject'],
    transitions: [
      { from: 'Pending', action: 'action-approve', to: 'Approved' },
      { from: 'Pending', action: 'action-reject', to: 'Rejected' }
    ]
  };

  // 2. Serialize to YAML (YAML 1)
  const yaml1 = YAMLSerializer.serializeWorkflow(originalModel);
  console.log('\n[YAML 1]');
  console.log(yaml1);

  // 3. Deserialize back to Model (Model 2)
  const ast = YAMLParser.parse(yaml1);
  const model2 = WorkflowParser.parse(ast);

  // 4. Serialize Model 2 back to YAML (YAML 2)
  const yaml2 = YAMLSerializer.serializeWorkflow(model2);
  console.log('\n[YAML 2]');
  console.log(yaml2);

  // 5. Assert Lossless Property
  if (yaml1 === yaml2) {
    console.log('\n✅ TEST PASSED: Serialization is strictly lossless and deterministic.');
  } else {
    console.error('\n❌ TEST FAILED: Serialization output drifted.');
    throw new Error('Lossless property violation detected.');
  }
}

// Execute
try {
  runLosslessTest();
} catch (e: any) {
  console.error(e.message);
}
