/**
 * IStateStore.ts
 *
 * Rich interface for state persistence.
 * Dependency Inversion isolates the Kernel from storage implementations.
 */

import { IExecutionContext } from './IExecutionContext';

export interface IStateStore {
  create(context: IExecutionContext): void;
  update(context: IExecutionContext): void;
  load(executionId: string): IExecutionContext | null;
  exists(executionId: string): boolean;
  delete(executionId: string): void; // Optional for testing/cleanup
}
