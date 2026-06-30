import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class CancellationTest implements ICertificationSuite {
  name = "CancellationTest";
  timeoutMs = 10000;

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const start = Date.now();
    
    const workflow = env.createDummyWorkflow("wf-cancel-test", RuntimeCapability.PLANNING);

    let cancelledUnitId = "";
    env.eventBus.subscribe("TaskQueued", (event: any) => {
      // the event payload is the unit
      const unit = event.payload || event;
      if (unit.id && !cancelledUnitId) {
        cancelledUnitId = unit.id;
        env.scheduler.cancel(unit.id, "Testing cancellation");
      }
    });

    const promise = env.runWorkflow(workflow, "t-cancel");
    
    try {
      await promise;
    } catch (e: any) {
      // expected to throw due to cancellation
    }

    const snap = env.scheduler.getSnapshot();
    const passed = snap.states["CANCELLED"] > 0;

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: { },
      evidence: [snap]
    };
  }
}
