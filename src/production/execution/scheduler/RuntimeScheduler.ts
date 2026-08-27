/**
 * RuntimeScheduler.ts
 *
 * Orchestrates the Pre-Execution and Post-Execution pipelines around the Kernel.
 * Strictly acts on IRuntimeDecision and delegates business logic to Managers.
 */

import { ExecutionKernel } from '../kernel/ExecutionKernel';
import { IExecutionContext } from '../contracts/IExecutionContext';
import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { IExecutionResult } from '../contracts/IExecutionResult';
import { TimeoutManager } from '../services/TimeoutManager';
import { RetryManager } from '../services/RetryManager';
import { IResourceLimiter } from '../services/ResourceLimiter';
import { IDeadLetterQueue } from '../dlq/IDeadLetterQueue';
import { LifecycleManager } from '../lifecycle/LifecycleManager';
import { IEventDispatcher } from '../../observability/contracts/IEventDispatcher';
import { randomUUID } from 'crypto';

export class RuntimeScheduler {
  constructor(
    private kernel: ExecutionKernel,
    private lifecycle: LifecycleManager,
    private timeoutManager: TimeoutManager,
    private retryManager: RetryManager,
    private resourceLimiter: IResourceLimiter,
    private dlq: IDeadLetterQueue,
    private dispatcher: IEventDispatcher
  ) {}
  
  public async scheduleStart(context: IExecutionContext, pkg: IExecutionPackage): Promise<void> {
    // 1. Pre-Pipeline: Evaluate Resources
    const decision = this.resourceLimiter.evaluate(context);
    
    if (decision.decision === 'WAIT') {
      this.dispatcher.publish({
        event_id: randomUUID(),
        event_version: '1.0',
        type: 'ExecutionQueued',
        execution_id: context.metadata.execution_id,
        timestamp: new Date().toISOString(),
        payload: { reason: decision.reason }
      });
      return; // Will be picked up later (Beta 4 Queue)
    }
    
    if (decision.decision === 'REJECT') {
      this.dispatcher.publish({
        event_id: randomUUID(),
        event_version: '1.0',
        type: 'ExecutionRejected',
        execution_id: context.metadata.execution_id,
        timestamp: new Date().toISOString(),
        payload: { reason: decision.reason }
      });
      return;
    }
    
    // 2. Reserve and Start
    this.resourceLimiter.reserve(context);
    const startEvent = this.lifecycle.start(context);
    this.dispatcher.publish(startEvent);
  }
  
  public async scheduleTransition(
    context: IExecutionContext, 
    pkg: IExecutionPackage, 
    action: string, 
    payload: any = {}
  ): Promise<void> {
    
    // 1. Pre-Pipeline: Evaluate Timeout
    const timeoutDecision = this.timeoutManager.evaluate(context);
    
    if (timeoutDecision.decision === 'REJECT') {
      this.handleTerminalFailure(context, pkg, timeoutDecision.reason, 'TIMEOUT');
      return;
    }
    
    try {
      // 2. Kernel Execution (The Core)
      const events = this.kernel.transition(context, pkg, action, payload);
      
      // Dispatch Core Events
      for (const e of events) {
        this.dispatcher.publish(e);
      }
      
      // If completed successfully, release resources
      if (context.state.status === 'COMPLETED') {
        this.resourceLimiter.release(context);
      }
      
    } catch (error: any) {
      // 3. Post-Pipeline: Handle Failures
      const result: IExecutionResult = {
        status: 'RETRYABLE_FAILURE', // Assuming all kernel crashes are retryable for simplicity here, logic would be deeper in reality
        message: error.message,
        error
      };
      
      const retryDecision = this.retryManager.evaluate(context, result);
      
      if (retryDecision.decision === 'RETRY') {
        context.state.retry_count++;
        this.dispatcher.publish({
          event_id: randomUUID(),
          event_version: '1.0',
          type: 'ExecutionRetried',
          execution_id: context.metadata.execution_id,
          timestamp: new Date().toISOString(),
          payload: { reason: retryDecision.reason, new_count: context.state.retry_count }
        });
        // We would schedule a delayed retry here, using wait_ms.
      } else {
        this.handleTerminalFailure(context, pkg, retryDecision.reason, 'EXHAUSTED_RETRIES');
      }
    }
  }
  
  private handleTerminalFailure(
    context: IExecutionContext, 
    pkg: IExecutionPackage, 
    reason: string, 
    category: 'TIMEOUT' | 'EXHAUSTED_RETRIES' | 'TERMINAL_ERROR' | 'UNKNOWN'
  ): void {
    
    // Finish context as Failed
    const failEvent = this.lifecycle.finish(context, false);
    this.dispatcher.publish(failEvent);
    
    // Move to DLQ
    this.dlq.push({
      execution_id: context.metadata.execution_id,
      failure_reason: reason,
      failure_category: category,
      context: context,
      package_snapshot: pkg
    });
    
    this.dispatcher.publish({
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'ExecutionMovedToDLQ',
      execution_id: context.metadata.execution_id,
      timestamp: new Date().toISOString(),
      payload: { reason, category }
    });
    
    // Release resources
    this.resourceLimiter.release(context);
  }
}
