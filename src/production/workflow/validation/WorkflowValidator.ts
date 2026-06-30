import { Workflow } from "../contracts/Workflow";
import { Task } from "../contracts/Task";

export class WorkflowValidator {
  static validate(workflow: Workflow): void {
    if (!workflow.stages || workflow.stages.length === 0) {
      throw new Error(`Workflow ${workflow.metadata.id} is empty (no stages).`);
    }

    const taskIds = new Set<string>();

    for (const stage of workflow.stages) {
      if (!stage.jobs || stage.jobs.length === 0) {
        throw new Error(`Stage ${stage.id} is empty (no jobs).`);
      }

      for (const job of stage.jobs) {
        if (!job.tasks || job.tasks.length === 0) {
          throw new Error(`Job ${job.id} is empty (no tasks).`);
        }

        const jobTaskIds = new Set<string>();
        
        for (const task of job.tasks) {
          if (taskIds.has(task.id)) {
            throw new Error(`Duplicate Task ID found globally: ${task.id}`);
          }
          taskIds.add(task.id);
          jobTaskIds.add(task.id);
        }

        // Validate dependencies exist within the SAME JOB
        // (Currently, DAG is resolved per Job)
        for (const task of job.tasks) {
          for (const dep of task.dependencies) {
            if (!jobTaskIds.has(dep)) {
              throw new Error(`Task ${task.id} depends on unknown or out-of-scope task: ${dep}`);
            }
          }
        }
      }
    }
  }
}
