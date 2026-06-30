import { Job } from "../contracts/Job";
import { Task } from "../contracts/Task";

export class DAGResolver {
  /**
   * Sorts the tasks within a Job into an array of execution groups.
   * Each group (array of tasks) can be executed in parallel.
   * Group N depends on Group N-1.
   */
  static resolveLevels(job: Job): Task[][] {
    const tasks = new Map(job.tasks.map(t => [t.id, t]));
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const task of job.tasks) {
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    }

    // Build graph and in-degrees
    for (const task of job.tasks) {
      for (const dep of task.dependencies) {
        if (!graph.has(dep)) graph.set(dep, []);
        graph.get(dep)!.push(task.id);
        inDegree.set(task.id, inDegree.get(task.id)! + 1);
      }
    }

    const levels: Task[][] = [];
    let queue: string[] = [];

    // Find starting nodes (in-degree 0)
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(id);
    }

    let resolvedCount = 0;

    while (queue.length > 0) {
      const currentLevelTasks: Task[] = queue.map(id => tasks.get(id)!);
      levels.push(currentLevelTasks);
      resolvedCount += queue.length;

      const nextQueue: string[] = [];
      for (const id of queue) {
        const neighbors = graph.get(id) || [];
        for (const neighbor of neighbors) {
          const degree = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, degree);
          if (degree === 0) {
            nextQueue.push(neighbor);
          }
        }
      }
      queue = nextQueue;
    }

    if (resolvedCount !== job.tasks.length) {
      throw new Error(`Circular dependency detected in Job ${job.id}`);
    }

    return levels;
  }
}
