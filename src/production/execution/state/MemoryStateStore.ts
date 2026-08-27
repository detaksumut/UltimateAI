/**
 * MemoryStateStore.ts
 *
 * In-memory implementation of IStateStore.
 * Dependency Injection ensures we can easily swap to Redis/DB later.
 */

import { IStateStore } from '../contracts/IStateStore';
import { IExecutionContext } from '../contracts/IExecutionContext';

export class MemoryStateStore implements IStateStore {
  private store = new Map<string, string>(); // Storing stringified to simulate serialization
  
  public create(context: IExecutionContext): void {
    if (this.exists(context.metadata.execution_id)) {
      throw new Error(`StateStore Error: Execution ${context.metadata.execution_id} already exists.`);
    }
    this.store.set(context.metadata.execution_id, JSON.stringify(context));
  }
  
  public update(context: IExecutionContext): void {
    if (!this.exists(context.metadata.execution_id)) {
      throw new Error(`StateStore Error: Execution ${context.metadata.execution_id} not found.`);
    }
    this.store.set(context.metadata.execution_id, JSON.stringify(context));
  }
  
  public load(executionId: string): IExecutionContext | null {
    const data = this.store.get(executionId);
    if (!data) return null;
    return JSON.parse(data) as IExecutionContext;
  }
  
  public exists(executionId: string): boolean {
    return this.store.has(executionId);
  }
  
  public delete(executionId: string): void {
    this.store.delete(executionId);
  }
}
