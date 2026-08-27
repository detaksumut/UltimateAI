/**
 * ScenarioRunner.ts
 *
 * Defines and injects real-world scenarios for Validation.
 */

import { ValidationRunner } from './ValidationRunner';

export class ScenarioRunner {
  constructor(private validation: ValidationRunner) {}
  
  public async runTodoScenario(): Promise<void> {
    console.log('[Scenario] Running Todo Approval...');
    await this.validation.executeScenario('todo', [
      { name: 'create', payload: { action: 'CREATE_TODO' }, expectedStatus: 'COMPLETED' },
      { name: 'approve', payload: { action: 'APPROVE_TODO' }, expectedStatus: 'COMPLETED' },
      { name: 'complete', payload: { action: 'FINISH_TODO' }, expectedStatus: 'COMPLETED' }
    ]);
  }
  
  public async runJournalScenario(): Promise<void> {
    console.log('[Scenario] Running Journal Double-Blind Review...');
    await this.validation.executeScenario('journal', [
      { name: 'phaseA_submission', payload: { action: 'SUBMIT_MANUSCRIPT' }, expectedStatus: 'COMPLETED' },
      { name: 'phaseB_review', payload: { action: 'REVIEW_REVISION_LOOP' }, expectedStatus: 'COMPLETED' },
      { name: 'phaseC_decision', payload: { action: 'PUBLISH_DECISION' }, expectedStatus: 'COMPLETED' }
    ]);
  }
  
  public async runCertificationScenario(): Promise<void> {
    console.log('[Scenario] Running Professional Certification...');
    await this.validation.executeScenario('certification', [
      { name: 'registration', payload: { action: 'REGISTER_CANDIDATE' }, expectedStatus: 'COMPLETED' },
      { name: 'assessment', payload: { examScore: 85, interviewNotes: 'Excellent' }, expectedStatus: 'COMPLETED' },
      { name: 'decision', payload: { boardDecision: 'APPROVE', certNumber: 'CERT-1001' }, expectedStatus: 'COMPLETED' }
    ]);
  }
  
  public async runMembershipScenario(): Promise<void> {
    console.log('[Scenario] Running Membership Approval...');
    await this.validation.executeScenario('membership', [
      { name: 'register', payload: { action: 'REGISTER_MEMBER' }, expectedStatus: 'COMPLETED' },
      { name: 'document_verification', payload: { action: 'VERIFY_DOCS' }, expectedStatus: 'COMPLETED' },
      { name: 'review', payload: { action: 'REVIEW_APPLICATION' }, expectedStatus: 'COMPLETED' },
      { name: 'decision', payload: { decision: 'APPROVE' }, expectedStatus: 'COMPLETED' },
      { name: 'activation', payload: { action: 'ACTIVATE_MEMBER' }, expectedStatus: 'COMPLETED' }
    ]);
  }
}
