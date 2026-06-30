import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { TestEnvironment } from "../framework/TestEnvironment";
import { Workflow } from "../../../production/workflow/contracts/Workflow";
import { RuntimeCapability } from "../../../production/runtime/contracts/RuntimeCapability";

export default class ExecutionStressTest implements ICertificationSuite {
  name = "ExecutionStressTest";
  timeoutMs = 60000; // 60 seconds

  async execute(seed: string): Promise<SuiteResult> {
    const env = new TestEnvironment();
    const workflowsCount = 100;
    const start = Date.now();
    const metrics: any = { started: 0, completed: 0, failed: 0 };
    
    // Create 100 identical dummy workflows
    const workflows: Workflow[] = Array.from({ length: workflowsCount }).map((_, i) => env.createDummyWorkflow(`wf-stress-${i}`, RuntimeCapability.PLANNING));

    // Start all concurrently
    const promises = workflows.map(async (w, i) => {
      metrics.started++;
      try {
        await env.runWorkflow(w, `t-stress-${i}`);
        metrics.completed++;
      } catch (err: any) {
        metrics.failed++;
        metrics.lastError = err.message;
      }
    });

    await Promise.all(promises);
    
    // Wait for event bus and promises to fully resolve
    await new Promise(r => setTimeout(r, 100));
    const snap = env.scheduler.getSnapshot();

    const passed = metrics.completed === workflowsCount && metrics.failed === 0 && snap.states["RUNNING"] === 0;

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics,
      evidence: [snap]
    };
  }
}
