// WorkflowDefinition with rich metadata
import { WorkflowStep } from './WorkflowStep';
export interface WorkflowDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  permissions?: string[];
  requiredCapabilities?: string[];
  outputs?: Record<string, unknown>;
  steps: WorkflowStep[];
}
