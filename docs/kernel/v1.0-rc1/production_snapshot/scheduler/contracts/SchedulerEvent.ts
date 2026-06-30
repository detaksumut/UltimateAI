import { ExecutionState } from "./ExecutionUnit";

export type SchedulerEventType = 
  | "TaskQueued" 
  | "TaskScheduled" 
  | "TaskStarted" 
  | "TaskWaiting" 
  | "TaskCancelled" 
  | "TaskFinished" 
  | "ResourceAllocated" 
  | "ResourceReleased";

export interface SchedulerEvent {
  eventId: string;
  traceId: string;
  eventType: SchedulerEventType;
  unitId: string;
  newState?: ExecutionState;
  timestamp: number;
  payload?: any;
}
