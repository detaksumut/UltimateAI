import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class ExecutionIsolationTest implements ICertificationSuite {
  name = "ExecutionIsolationTest";
  timeoutMs = 15000;

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const start = Date.now();
    
    const wfA = env.createDummyWorkflow("wf-A");
    const wfB = env.createDummyWorkflow("wf-B");

    let eventsA = 0;
    let eventsB = 0;
    
    env.eventBus.subscribe("TaskStarted", (evt) => {
      if (evt.traceId === "trace-A") eventsA++;
      if (evt.traceId === "trace-B") eventsB++;
    });

    await Promise.all([
      env.runWorkflow(wfA, "trace-A"),
      env.runWorkflow(wfB, "trace-B")
    ]);

    const passed = (eventsA > 0 && eventsB > 0);

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: { eventsA, eventsB },
      evidence: []
    };
  }
}
