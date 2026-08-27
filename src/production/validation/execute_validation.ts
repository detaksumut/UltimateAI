/**
 * execute_validation.ts
 *
 * Bootstraps and executes the entire EAEP Validation Program.
 */

import * as path from 'path';
import { ArtifactRunner } from './runners/ArtifactRunner';
import { PipelineRunner } from './runners/PipelineRunner';
import { AssertionRunner } from './runners/AssertionRunner';
import { ValidationRunner } from './runners/ValidationRunner';
import { ScenarioRunner } from './runners/ScenarioRunner';

async function main() {
  const baseDir = path.resolve(__dirname, '..', '..', '..', '..');
  const artifactDir = path.join(baseDir, 'src', 'production', 'validation');
  
  const artifact = new ArtifactRunner(artifactDir);
  const pipeline = new PipelineRunner(artifact);
  const assertion = new AssertionRunner();
  const validation = new ValidationRunner(pipeline, artifact, assertion);
  const scenario = new ScenarioRunner(validation);
  
  await scenario.runTodoScenario();
  await scenario.runJournalScenario();
  await scenario.runCertificationScenario();
  await scenario.runMembershipScenario();
  
  validation.generateValidationMatrix();
  
  console.log('✅ EAEP Validation Program Completed.');
}

main().catch(console.error);
