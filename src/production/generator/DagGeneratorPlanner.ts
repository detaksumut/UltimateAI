import { SolutionArchitecture, ServiceNode } from "./SolutionArchitect";

export interface GenerationTask {
  readonly taskId: string;
  readonly targetServiceId: string;
  readonly targetService: ServiceNode;
  readonly generatorId: string;
  readonly order: number;
  readonly dependsOn: string[];
}

export interface GenerationDAG {
  readonly dagId: string;
  readonly tasks: GenerationTask[];
  readonly executionOrder: GenerationTask[][];
}

/**
 * DagGeneratorPlanner receives a SolutionArchitecture and produces a
 * Directed Acyclic Graph (DAG) of GenerationTask objects, each mapped
 * to the most appropriate generator from the Generator Registry.
 */
export class DagGeneratorPlanner {
  private readonly GENERATOR_MAP: Record<string, string> = {
    backend: "GEN-NEST",
    frontend: "GEN-REACT",
    database: "GEN-POSTGRES",
    cache: "GEN-REDIS",
    broker: "GEN-KAFKA",
    gateway: "GEN-GATEWAY"
  };

  plan(architecture: SolutionArchitecture): GenerationDAG {
    const tasks: GenerationTask[] = [];

    // Build tasks, mapping each service to a generator
    let orderCounter = 0;
    for (const svc of architecture.services) {
      const generatorId = this.GENERATOR_MAP[svc.type] ?? `GEN-${svc.type.toUpperCase()}`;
      tasks.push({
        taskId: `task-${svc.serviceId}`,
        targetServiceId: svc.serviceId,
        targetService: svc,
        generatorId,
        order: orderCounter++,
        dependsOn: (architecture.dependencyGraph[svc.serviceId] ?? []).map(dep => `task-${dep}`)
      });
    }

    // Topological sort (Kahn's algorithm)
    const executionOrder = this.topologicalSort(tasks);

    const dagId = `dag-${architecture.architectureId}-${Date.now()}`;
    return { dagId, tasks, executionOrder };
  }

  private topologicalSort(tasks: GenerationTask[]): GenerationTask[][] {
    const taskMap = new Map<string, GenerationTask>(tasks.map(t => [t.taskId, t]));
    const inDegree = new Map<string, number>(tasks.map(t => [t.taskId, t.dependsOn.length]));
    const levels: GenerationTask[][] = [];

    let remaining = [...tasks];
    while (remaining.length > 0) {
      const ready = remaining.filter(t => (inDegree.get(t.taskId) ?? 0) === 0);
      if (ready.length === 0) break; // Cycle guard
      levels.push(ready);
      remaining = remaining.filter(t => !ready.includes(t));
      for (const task of ready) {
        for (const dependent of tasks.filter(t => t.dependsOn.includes(task.taskId))) {
          inDegree.set(dependent.taskId, (inDegree.get(dependent.taskId) ?? 1) - 1);
        }
      }
    }
    return levels;
  }
}
