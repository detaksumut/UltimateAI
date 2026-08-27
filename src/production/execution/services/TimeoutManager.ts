/**
 * TimeoutManager.ts
 *
 * Stateless evaluative manager. Checks if an execution has exceeded its immutable policy timeout.
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IRuntimeDecision } from '../contracts/IRuntimeDecision';

export class TimeoutManager {
  
  public evaluate(context: IExecutionContext, nowMs: number = Date.now()): IRuntimeDecision {
    const policy = context.metadata.policy;
    
    // For pending/completed executions, timeout doesn't apply directly in the same way,
    // but assuming this evaluates RUNNING executions
    if (context.state.status !== 'RUNNING') {
      return { decision: 'CONTINUE', reason: `Status is ${context.state.status}` };
    }
    
    const startedAt = new Date(context.metadata.created_at).getTime(); // Or use a separate started_at field
    const elapsed = nowMs - startedAt;
    
    if (elapsed > policy.timeout_ms) {
      return { decision: 'REJECT', reason: `Execution timed out after ${elapsed}ms (Limit: ${policy.timeout_ms}ms)` };
    }
    
    return { decision: 'CONTINUE', reason: 'Within timeout limits' };
  }
}
