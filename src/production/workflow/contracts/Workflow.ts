import { Stage } from "./Stage";

export interface WorkflowMetadata {
  id: string;
  name: string;
  version: string;
  createdBy: string;
  tags: string[];
  description: string;
}

export interface Workflow {
  metadata: WorkflowMetadata;
  stages: Stage[]; // Executed sequentially
}
