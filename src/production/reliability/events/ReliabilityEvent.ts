export type ReliabilityEventType = 
  | "CheckpointCreated" 
  | "RetryScheduled" 
  | "RetryStarted" 
  | "RetrySucceeded" 
  | "RetryFailed" 
  | "CircuitOpened" 
  | "CircuitClosed" 
  | "ResumeStarted" 
  | "ResumeCompleted";

export interface ReliabilityEvent {
  eventId: string;
  traceId: string;
  eventType: ReliabilityEventType;
  runtimeId?: string;
  timestamp: number;
  payload?: any;
}
