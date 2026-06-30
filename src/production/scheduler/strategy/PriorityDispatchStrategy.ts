import { DispatchStrategy } from "./DispatchStrategy";
import { ExecutionUnit } from "../contracts/ExecutionUnit";

export class PriorityDispatchStrategy implements DispatchStrategy {
  getNext(readyQueue: ExecutionUnit[]): ExecutionUnit | undefined {
    if (readyQueue.length === 0) return undefined;
    
    // Assumes queue is already sorted by sort()
    // Shift removes the first element
    return readyQueue.shift();
  }

  sort(readyQueue: ExecutionUnit[]): void {
    readyQueue.sort((a, b) => {
      // Higher priority first
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // FIFO for same priority
      return a.submittedAt - b.submittedAt;
    });
  }
}
