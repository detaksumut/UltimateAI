import { IWorkflowRegistry } from '../interfaces';
import { WorkflowDefinition } from '../types/WorkflowDefinition';

/** In-memory registry for workflow definitions */
export class WorkflowRegistry implements IWorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();

  register(definition: WorkflowDefinition): void {
    if (!definition.id) {
      throw new Error('WorkflowDefinition must have an id');
    }
    if (this.definitions.has(definition.id)) {
      throw new Error(`Workflow definition with id ${definition.id} already registered`);
    }
    this.definitions.set(definition.id, definition);
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }
}
