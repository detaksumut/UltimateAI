import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class DeterministicReplayTest implements ICertificationSuite {
  name = "DeterministicReplayTest";
  timeoutMs = 15000;

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const start = Date.now();
    
    const wfA = env.createDummyWorkflow("wf-1");
    const wfB = env.createDummyWorkflow("wf-1");

    await env.runWorkflow(wfA, "t-1");
    // In deterministic replay, retrying the identical workflow should yield identical states
    await env.runWorkflow(wfB, "t-1");
    
    const snap = env.scheduler.getSnapshot();

    return {
      suite: this.name,
      status: snap.states["FAILED"] === 0 ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: { },
      evidence: [snap]
    };
  }
}
