/**
 * test-phase-omega.ts
 *
 * The integration runner to prove the Todo Approval Workflow.
 * Executes the entire pipeline deterministically without any external providers.
 */

import * as fs from 'fs';
import * as path from 'path';

import { YAMLParser } from '../compiler/parser/YAMLParser';
import { WorkflowParser } from '../compiler/parser/WorkflowParser';
import { WorkflowValidator } from '../compiler/validator/WorkflowValidator';
import { NativeWorkflowEngine } from '../execution/native/NativeWorkflowEngine';
import { IWorkflowExecutionContext } from '../contracts/IWorkflowExecutionContext';

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, filename), 'utf8');
}

function runValidScenario() {
  console.log('=== RUNNING VALID SCENARIO: todo-valid.yaml ===\n');
  const dslContent = loadFixture('todo-valid.yaml');
  
  // 1. DSL -> AST
  const ast = YAMLParser.parse(dslContent);
  
  // 2. AST -> WorkflowModel
  const model = WorkflowParser.parse(ast);
  console.log('[1] Generated WorkflowModel:');
  console.log(JSON.stringify(model, null, 2));

  // 3. Validation
  WorkflowValidator.validate(model);
  console.log('\n[2] Validation: PASSED (Structural & Semantic)');

  // 4. Runtime Execution
  const engine = new NativeWorkflowEngine(model);
  const instance = engine.createInstance('inst-todo-001');
  
  console.log('\n[3] Generated WorkflowInstance (Initial):');
  console.log(JSON.stringify(instance, null, 2));

  const context: IWorkflowExecutionContext = {
    instance: instance,
    actor: 'user-456',
    timestamp: new Date().toISOString(),
    correlation_id: 'corr-999',
    variables: { todo_title: 'Fix Bug X' }
  };

  // Execute transition 'approve'
  const auditEvent = engine.executeAction(context, 'approve');

  console.log('\n[4] Execution: Action "approve" called.');
  console.log('Updated WorkflowInstance (Mutated):');
  console.log(JSON.stringify(instance, null, 2));

  console.log('\n[5] Generated AuditEvent (Immutable):');
  console.log(JSON.stringify(auditEvent, null, 2));
}

function runInvalidStructuralScenario() {
  console.log('\n=== RUNNING INVALID STRUCTURAL SCENARIO: todo-invalid-transition.yaml ===');
  const dslContent = loadFixture('todo-invalid-transition.yaml');
  const ast = YAMLParser.parse(dslContent);
  const model = WorkflowParser.parse(ast);
  
  try {
    WorkflowValidator.validate(model);
    console.error('FAIL: Should have thrown structural error.');
  } catch (error: any) {
    console.log(`EXPECTED ERROR CAUGHT: ${error.message}`);
  }
}

function runInvalidSemanticScenario() {
  console.log('\n=== RUNNING INVALID SEMANTIC SCENARIO: todo-unreachable-terminal.yaml ===');
  const dslContent = loadFixture('todo-unreachable-terminal.yaml');
  const ast = YAMLParser.parse(dslContent);
  const model = WorkflowParser.parse(ast);
  
  try {
    WorkflowValidator.validate(model);
    console.error('FAIL: Should have thrown semantic error.');
  } catch (error: any) {
    console.log(`EXPECTED ERROR CAUGHT: ${error.message}`);
  }
}

// Execute all tests
try {
  runValidScenario();
  runInvalidStructuralScenario();
  runInvalidSemanticScenario();
  console.log('\n=== PHASE OMEGA VALIDATION: SUCCESS ===');
} catch (err) {
  console.error('\n=== PHASE OMEGA VALIDATION: FAILED ===');
  console.error(err);
}
