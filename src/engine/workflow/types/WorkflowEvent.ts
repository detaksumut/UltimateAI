export type WorkflowEvent = {
  id: string;
  timestamp: Date;
  executionId: string;
  workflowId: string;
  type: string;
  payload?: Record<string, unknown>;
};
