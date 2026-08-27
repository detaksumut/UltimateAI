/**
 * RetryManager.ts
 *
 * Stateless evaluative manager. Determines if a failed execution can be retried
 * based on the ExecutionResult and the immutable policy.
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IExecutionResult } from '../contracts/IExecutionResult';
import { IRuntimeDecision } from '../contracts/IRuntimeDecision';

export class RetryManager {
  
  public evaluate(context: IExecutionContext, result: IExecutionResult): IRuntimeDecision {
    if (result.status === 'SUCCESS') {
      return { decision: 'CONTINUE', reason: 'Execution was successful' };
    }
    
    if (result.status === 'TERMINAL_FAILURE') {
      return { decision: 'DLQ', reason: `Terminal failure: ${result.message}` };
    }
    
    // It's a RETRYABLE_FAILURE
    const policy = context.metadata.policy;
    if (context.state.retry_count < policy.max_retries) {
      return { 
        decision: 'RETRY', 
        reason: `Retryable failure (${context.state.retry_count}/${policy.max_retries})`,
        wait_ms: policy.retry_backoff_ms
      };
    }
    
    return { decision: 'DLQ', reason: `Exhausted retries (${policy.max_retries})` };
  }
}
