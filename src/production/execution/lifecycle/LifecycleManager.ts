/**
 * LifecycleManager.ts
 *
 * Manages Start, Pause, Resume, and Finish operations.
 * Allows the Kernel to focus strictly on State Transitions.
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IStateStore } from '../contracts/IStateStore';
import { IExecutionEvent } from '../contracts/IExecutionEvent';
import { randomUUID } from 'crypto';

export class LifecycleManager {
  constructor(private store: IStateStore) {}
  
  public start(context: IExecutionContext): IExecutionEvent {
    context.state.status = 'RUNNING';
    context.state.history.push(`Started execution at ${context.state.current_state}`);
    this.store.create(context);
    
    return {
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'ExecutionStarted',
      execution_id: context.metadata.execution_id,
      timestamp: new Date().toISOString(),
      payload: { initial_state: context.state.current_state }
    };
  }
  
  public finish(context: IExecutionContext, success: boolean): IExecutionEvent {
    context.state.status = success ? 'COMPLETED' : 'FAILED';
    context.state.completed_at = new Date().toISOString();
    context.state.history.push(`Execution ${success ? 'completed' : 'failed'}`);
    this.store.update(context);
    
    return {
      event_id: randomUUID(),
      event_version: '1.0',
      type: success ? 'ExecutionCompleted' : 'ExecutionFailed',
      execution_id: context.metadata.execution_id,
      timestamp: context.state.completed_at,
      payload: { final_state: context.state.current_state }
    };
  }
  
  public pause(context: IExecutionContext): IExecutionEvent {
    if (context.state.status !== 'RUNNING') throw new Error('Cannot pause non-running execution.');
    context.state.status = 'PAUSED';
    context.state.history.push('Execution paused');
    this.store.update(context);
    
    return {
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'ExecutionPaused',
      execution_id: context.metadata.execution_id,
      timestamp: new Date().toISOString(),
      payload: {}
    };
  }
  
  public resume(context: IExecutionContext): IExecutionEvent {
    if (context.state.status !== 'PAUSED') throw new Error('Cannot resume unpaused execution.');
    context.state.status = 'RUNNING';
    context.state.history.push('Execution resumed');
    this.store.update(context);
    
    return {
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'ExecutionResumed',
      execution_id: context.metadata.execution_id,
      timestamp: new Date().toISOString(),
      payload: {}
    };
  }
}
