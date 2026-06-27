// src/execution/scheduler/TaskScheduler.ts

import { TaskGraph } from "../../planner/TaskGraph";
import { TaskNode } from "../../planner/models/TaskNode";

/**
 * TaskScheduler is responsible for determining which tasks from the TaskGraph
 * are ready to run next based on dependency constraints.
 */
export class TaskScheduler {
  /**
   * Identifies all tasks that are ready to run because they have not yet been executed
   * and all of their dependencies have been completed.
   *
   * Deterministic logic:
   * - Tasks with no dependencies run first.
   * - If multiple tasks are ready, they are sorted alphabetically by ID.
   *
   * @param graph - the immutable TaskGraph to analyze
   * @param completedTaskIds - set of task IDs that have completed successfully
   * @returns a list of ready task nodes in deterministic order
   */
  public getReadyTasks(
    graph: TaskGraph,
    completedTaskIds: ReadonlySet<string>
  ): readonly TaskNode[] {
    // TODO: parallel scheduling
    // TODO: priority scheduling
    // TODO: resource-aware scheduling

    return graph.nodes
      .filter(
        node => !completedTaskIds.has(node.id) &&
                node.dependencies.every(depId => completedTaskIds.has(depId))
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Compatibility method for skeleton Engine.
   * @deprecated Use getReadyTasks instead.
   */
  public schedule(graph: TaskGraph): readonly TaskNode[] {
    return graph.nodes;
  }
}
