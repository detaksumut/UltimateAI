import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";

export interface Task {
  id: string;
  name: string;
  capability: RuntimeCapability;
  dependencies: string[]; // List of Task IDs this task depends on (within the same Job)
}
