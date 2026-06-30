import { ExecutionUnit } from "../contracts/ExecutionUnit";

export interface DispatchStrategy {
  /**
   * Evaluates the READY queue and returns the next ExecutionUnit to run,
   * or undefined if the queue is empty.
   */
  getNext(readyQueue: ExecutionUnit[]): ExecutionUnit | undefined;
  
  /**
   * Called to re-sort or optimize the queue when a new task is added
   * or a resource becomes available.
   */
  sort(readyQueue: ExecutionUnit[]): void;
}
