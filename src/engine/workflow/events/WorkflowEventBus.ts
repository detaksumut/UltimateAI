import { IWorkflowEventBus } from '../interfaces';
import { WorkflowEvent } from '../types/WorkflowEvent';

/** Simple in-memory event bus */
export class WorkflowEventBus implements IWorkflowEventBus {
  private listeners: Array<(event: WorkflowEvent) => void> = [];

  publish(event: WorkflowEvent): void {
    // Notify all listeners synchronously
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: (event: WorkflowEvent) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }
}
