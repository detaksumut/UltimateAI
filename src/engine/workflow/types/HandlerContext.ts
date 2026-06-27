import { WorkflowStep } from './WorkflowStep';
import { WorkflowExecution } from './WorkflowExecution';
import { WorkflowDefinition } from './WorkflowDefinition';

/**
 * Primary context object passed to every IStepHandler.
 * It groups all execution‑related information that a handler may need.
 * Future extensions (logger, telemetry, service access, etc.) should be added
 * as optional properties so the method signature of `IStepHandler.execute`
 * remains stable.
 */
export interface HandlerContext {
  /** The step being executed */
  step: WorkflowStep;
  /** Current execution record (immutable updates are expected) */
  execution: WorkflowExecution;
  /** Workflow definition that owns the step */
  definition: WorkflowDefinition;
  /** AbortSignal for cancellation */
  signal: AbortSignal;
  /** Optional runtime metadata (e.g., timestamps, tracing ids) */
  metadata?: Record<string, unknown>;
}
