// tests/e2e/taskExecutor.spec.ts

import { test, expect } from "@playwright/test";
import { TaskExecutor } from "../../src/execution/executor/TaskExecutor";
import { TaskNode } from "../../src/planner/models/TaskNode";
import { ExecutionContext } from "../../src/execution/models/ExecutionContext";

test.describe("TaskExecutor Unit Tests", () => {
  const executor = new TaskExecutor();

  const mockContext = (isCancelled: boolean): ExecutionContext => ({
    executionId: "exec-123",
    workflowId: "wf-456",
    variables: new Map(),
    metadata: {},
    cancellationToken: { isCancellationRequested: isCancelled }
  });

  test("should successfully execute normal task capability", async () => {
    const node: TaskNode = {
      id: "task-1",
      capability: "test_capability",
      description: "Test run",
      dependencies: []
    };
    const ctx = mockContext(false);

    const result = await executor.execute(node, ctx);

    expect(result.taskId).toBe("task-1");
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.output).toBeDefined();
    expect((result.output as any).executedCapability).toBe("test_capability");
  });

  test("should fail execution for fail_placeholder capability", async () => {
    const node: TaskNode = {
      id: "task-2",
      capability: "fail_placeholder",
      description: "Fail test",
      dependencies: []
    };
    const ctx = mockContext(false);

    const result = await executor.execute(node, ctx);

    expect(result.taskId).toBe("task-2");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("failed by placeholder design");
    expect(result.output).toBeUndefined();
  });

  test("should abort and return failure if cancellation is requested", async () => {
    const node: TaskNode = {
      id: "task-3",
      capability: "test_capability",
      description: "Aborted run",
      dependencies: []
    };
    const ctx = mockContext(true);

    const result = await executor.execute(node, ctx);

    expect(result.taskId).toBe("task-3");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("cancelled before completion");
  });
});
