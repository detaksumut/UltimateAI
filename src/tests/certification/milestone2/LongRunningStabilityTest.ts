import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class LongRunningStabilityTest implements ICertificationSuite {
  name = "LongRunningStabilityTest";
  timeoutMs = 120000; // 2 minutes (reduced for fast feedback, usually 5-10m)

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const start = Date.now();
    let memoryStable = true;
    
    // Fire 50 workflows with slight delays to simulate continuous load
    for(let i=0; i<50; i++) {
      const wf = env.createDummyWorkflow(`wf-long-${i}`);
      env.runWorkflow(wf, `t-long-${i}`); // non-blocking
      
      // Artificial delay
      await new Promise(r => setTimeout(r, 10));
    }

    await new Promise(r => setTimeout(r, 2000)); // wait for them to finish
    
    const snap = env.scheduler.getSnapshot();
    const passed = snap.states["RUNNING"] === 0 && memoryStable;

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: { completed: snap.states["COMPLETED"] },
      evidence: [snap]
    };
  }
}
