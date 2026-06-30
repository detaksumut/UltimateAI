import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";
import { ExecutionContext } from "../../workflow/contracts/ExecutionContext";

export enum TaskPriority {
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum ExecutionState {
  READY = "READY",
  WAITING = "WAITING", // Queued but blocked by resources or limits
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}

export interface ExecutionUnit {
  id: string; // Globally unique identifier for this execution
  priority: TaskPriority;
  capability: RuntimeCapability;
  context: ExecutionContext;
  state: ExecutionState;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  // A promise resolver for the caller waiting on completion
  resolve?: (result: any) => void;
  reject?: (error: any) => void;
}
