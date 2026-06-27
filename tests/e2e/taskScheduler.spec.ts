// tests/e2e/taskScheduler.spec.ts

import { test, expect } from "@playwright/test";
import { TaskScheduler } from "../../src/execution/scheduler/TaskScheduler";
import { TaskGraph } from "../../src/planner/TaskGraph";

test.describe("TaskScheduler Unit Tests", () => {
  const scheduler = new TaskScheduler();

  test("graph linear (A -> B -> C)", () => {
    const graph: TaskGraph = {
      nodes: [
        { id: "A", capability: "capA", description: "Task A", dependencies: [] },
        { id: "B", capability: "capB", description: "Task B", dependencies: ["A"] },
        { id: "C", capability: "capC", description: "Task C", dependencies: ["B"] },
      ],
    };

    // Step 1: Nothing completed. A should be ready.
    const completed = new Set<string>();
    let ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("A");

    // Step 2: A completed. B should be ready.
    completed.add("A");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("B");

    // Step 3: B completed. C should be ready.
    completed.add("B");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("C");

    // Step 4: C completed. Nothing should be ready.
    completed.add("C");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(0);
  });

  test("graph bercabang (A -> {B, C})", () => {
    const graph: TaskGraph = {
      nodes: [
        { id: "A", capability: "capA", description: "Task A", dependencies: [] },
        { id: "B", capability: "capB", description: "Task B", dependencies: ["A"] },
        { id: "C", capability: "capC", description: "Task C", dependencies: ["A"] },
      ],
    };

    // Step 1: Nothing completed. A should be ready.
    const completed = new Set<string>();
    let ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("A");

    // Step 2: A completed. Both B and C are ready. Deterministic order (sorted by ID) should be B then C.
    completed.add("A");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(2);
    expect(ready[0].id).toBe("B");
    expect(ready[1].id).toBe("C");

    // Step 3: B is also completed. Only C is ready.
    completed.add("B");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("C");

    // Step 4: C is completed as well. Nothing should be ready.
    completed.add("C");
    ready = scheduler.getReadyTasks(graph, completed);
    expect(ready).toHaveLength(0);
  });
});
