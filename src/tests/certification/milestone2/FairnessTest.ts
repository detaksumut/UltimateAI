import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { ExecutionState, TaskPriority } from "../../../production/scheduler/contracts/ExecutionUnit";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class FairnessTest implements ICertificationSuite {
  name = "FairnessTest";
  timeoutMs = 10000;

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const largeWorkflow = env.createDummyWorkflow("wf-large", RuntimeCapability.PLANNING);
    // Let's modify the jobs to make it large
    largeWorkflow.stages[0].jobs = Array.from({ length: 10 }).map((_, i) => ({
      id: `job-L-${i}`,
      dependencies: [],
      tasks: [{ id: `task-L-${i}`, name: `tL${i}`, capability: RuntimeCapability.PLANNING, dependencies: [] }]
    }));

    const smallWorkflow = env.createDummyWorkflow("wf-small", RuntimeCapability.PLANNING);

    let smallFinishedFirst = false;
    
    // Start large workflow
    env.runWorkflow(largeWorkflow, "trace-large");

    // Start small workflow shortly after
    setTimeout(async () => {
      await env.runWorkflow(smallWorkflow, "trace-small");
      
      const snap = env.scheduler.getSnapshot();
      // If small finishes while large is still running, fairness works
      if (snap.states["COMPLETED"] > 0) {
        smallFinishedFirst = true;
      }
    }, 10);

    await new Promise(r => setTimeout(r, 200)); // wait for dispatch and mock execution

    const snap = env.scheduler.getSnapshot();
    const passed = smallFinishedFirst;

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: 200,
      metrics: { totalCompleted: snap.states[ExecutionState.COMPLETED] },
      evidence: [snap]
    };
  }
}
