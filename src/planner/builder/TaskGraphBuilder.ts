// src/planner/builder/TaskGraphBuilder.ts

/**
 * TaskGraphBuilder constructs a {@link TaskGraph} from a list of capability
 * identifiers. The current implementation creates a very simple graph where
 * each capability becomes an isolated {@link TaskNode}. Future versions will
 * infer dependencies, validate the DAG, detect cycles and perform optimisation.
 */
import { TaskGraph } from "../TaskGraph";
import { TaskNode } from "../models/TaskNode";

export class TaskGraphBuilder {
  /**
   * Build a {@link TaskGraph} based on the provided capabilities.
   * @param capabilities - Immutable array of capability identifiers.
   * @returns An immutable {@link TaskGraph} instance.
   */
  public build(capabilities: readonly string[]): TaskGraph {
    // TODO: dependency inference – determine edges between capabilities.
    // TODO: graph validation – ensure all nodes are well‑formed.
    // TODO: cycle detection – guarantee the graph is a DAG.
    // TODO: DAG optimisation – prune redundant nodes, merge similar tasks.

    const nodes: readonly TaskNode[] = capabilities.map((cap, idx) => ({
      id: `task-${idx + 1}`,
      capability: cap,
      description: `Capability task for "${cap}"`,
      dependencies: [],
    }));

    return { nodes };
  }
}
