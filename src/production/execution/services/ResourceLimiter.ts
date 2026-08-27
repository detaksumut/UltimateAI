/**
 * ResourceLimiter.ts
 *
 * Generic interface for resource limits (CPU, Memory, Concurrency, etc).
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IRuntimeDecision } from '../contracts/IRuntimeDecision';

export interface IResourceLimiter {
  evaluate(context: IExecutionContext): IRuntimeDecision;
  reserve(context: IExecutionContext): void;
  release(context: IExecutionContext): void;
}

export class ConcurrencyLimiter implements IResourceLimiter {
  private activeExecutions = 0;
  
  constructor(private maxConcurrent: number = 100) {}
  
  public evaluate(context: IExecutionContext): IRuntimeDecision {
    if (this.activeExecutions >= this.maxConcurrent) {
      // In a real system, you might enqueue this, or return WAIT
      return { decision: 'WAIT', reason: `Concurrency limit reached (${this.maxConcurrent})` };
    }
    return { decision: 'START', reason: 'Capacity available' };
  }
  
  public reserve(context: IExecutionContext): void {
    this.activeExecutions++;
  }
  
  public release(context: IExecutionContext): void {
    this.activeExecutions = Math.max(0, this.activeExecutions - 1);
  }
  
  public getActiveCount(): number {
    return this.activeExecutions;
  }
}
