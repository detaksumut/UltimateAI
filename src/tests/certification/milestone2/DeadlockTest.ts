import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class DeadlockTest implements ICertificationSuite {
  name = "DeadlockTest";
  timeoutMs = 15000;

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const start = Date.now();
    
    // Create a workflow with a diamond dependency pattern
    const workflow: Workflow = {
      metadata: { id: "wf-deadlock-test", name: "Deadlock", version: "1", createdBy: "test", tags: [], description: "" },
      stages: [
        {
          id: "stage-1",
          jobs: [
            { id: "job-A", tasks: [{ id: "task-A", name: "tA", capability: RuntimeCapability.PLANNING, dependencies: [] }], dependencies: [] },
            { id: "job-B1", tasks: [{ id: "task-B1", name: "tB1", capability: RuntimeCapability.REASONING, dependencies: [] }], dependencies: ["job-A"] },
            { id: "job-B2", tasks: [{ id: "task-B2", name: "tB2", capability: RuntimeCapability.REASONING, dependencies: [] }], dependencies: ["job-A"] },
            { id: "job-C", tasks: [{ id: "task-C", name: "tC", capability: RuntimeCapability.EXECUTION, dependencies: [] }], dependencies: ["job-B1", "job-B2"] }
          ]
        }
      ]
    };

    let passed = false;
    try {
      await env.runWorkflow(workflow, "t-deadlock");
      passed = true;
    } catch(e) {
      passed = false;
    }

    const snap = env.scheduler.getSnapshot();

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: { },
      evidence: [snap]
    };
  }
}
