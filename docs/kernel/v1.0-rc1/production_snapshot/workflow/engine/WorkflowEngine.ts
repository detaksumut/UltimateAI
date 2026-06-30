import { Workflow } from "../contracts/Workflow";
import { ExecutionContext } from "../contracts/ExecutionContext";
import { WorkflowValidator } from "../validation/WorkflowValidator";
import { DAGResolver } from "../validation/DAGResolver";
import { ExecutionScheduler } from "../../scheduler/engine/ExecutionScheduler";
import { ExecutionUnit, TaskPriority, ExecutionState } from "../../scheduler/contracts/ExecutionUnit";

export class WorkflowEngine {
  constructor(private readonly scheduler: ExecutionScheduler) {}

  async execute(workflow: Workflow, context: ExecutionContext): Promise<void> {
    console.log(`[WorkflowEngine] Starting Workflow: ${workflow.metadata.id} (Trace: ${context.traceId})`);
    
    // 1. Validate
    WorkflowValidator.validate(workflow);
    
    // 2. Execute Stages Sequentially
    for (const stage of workflow.stages) {
      console.log(`[WorkflowEngine] Starting Stage: ${stage.id}`);
      
      // 3. Execute Jobs in Parallel
      await Promise.all(stage.jobs.map(async (job) => {
        console.log(`[WorkflowEngine] Starting Job: ${job.id}`);
        
        // 4. Resolve Job DAG
        const levels = DAGResolver.resolveLevels(job);
        
        // 5. Execute DAG levels sequentially
        for (const level of levels) {
          // Tasks within the same level can run in parallel
          await Promise.all(level.map(async (task) => {
            console.log(`[WorkflowEngine] Submitting Task to Scheduler: ${task.id} (${task.capability})`);
            
            // Delegate Execution to the Scheduler
            return new Promise<void>((resolve, reject) => {
              const unit: ExecutionUnit = {
                id: `unit-${task.id}-${Date.now()}`,
                priority: TaskPriority.NORMAL, // Default priority
                capability: task.capability,
                context: context,
                state: ExecutionState.READY,
                submittedAt: Date.now(),
                resolve,
                reject
              };
              
              this.scheduler.submit(unit);
            });
            
          }));
        }
        
        console.log(`[WorkflowEngine] Completed Job: ${job.id}`);
      }));
      
      console.log(`[WorkflowEngine] Completed Stage: ${stage.id}`);
    }
    
    console.log(`[WorkflowEngine] Completed Workflow: ${workflow.metadata.id}`);
  }
}
