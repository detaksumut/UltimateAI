/**
 * ExecutionKernel.ts
 *
 * The central CPU of the Execution Domain.
 * Evaluates transitions based strictly on the ExecutionPlan.
 * Mutates state and produces internal events.
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { IStateStore } from '../contracts/IStateStore';
import { IExecutionEvent } from '../contracts/IExecutionEvent';
import { LifecycleManager } from '../lifecycle/LifecycleManager';
import { randomUUID } from 'crypto';

export class ExecutionKernel {
  constructor(
    private store: IStateStore,
    private lifecycle: LifecycleManager
  ) {}
  
  public transition(
    context: IExecutionContext, 
    pkg: IExecutionPackage, 
    action: string, 
    payload: any = {}
  ): IExecutionEvent[] {
    
    if (context.state.status !== 'RUNNING') {
      throw new Error(`Kernel Error: Cannot transition. Execution is in status ${context.state.status}`);
    }
    
    const currentState = context.state.current_state;
    const plan = pkg.plan;
    
    // 1. Find valid edge
    const edge = plan.edges.find(e => e.from_state === currentState && e.action === action);
    
    if (!edge) {
      throw new Error(`Kernel Error: Illegal transition. Action '${action}' is not allowed from state '${currentState}'.`);
    }
    
    // 2. Perform transition
    const nextState = edge.to_state;
    context.state.current_state = nextState;
    context.state.history.push(`Transitioned via '${action}' to '${nextState}'`);
    
    // 3. Update Variables
    context.state.variables = { ...context.state.variables, ...payload };
    
    // 4. Persist
    this.store.update(context);
    
    const events: IExecutionEvent[] = [];
    events.push({
      event_id: randomUUID(),
      event_version: '1.0',
      type: 'StateTransitioned',
      execution_id: context.metadata.execution_id,
      timestamp: new Date().toISOString(),
      payload: { from: currentState, action, to: nextState, variables: context.state.variables }
    });
    
    // 5. Check if Terminal
    const nextNode = plan.nodes.find(n => n.state_id === nextState);
    if (nextNode && nextNode.is_terminal) {
      const terminalEvent = this.lifecycle.finish(context, true); // Assuming all terminals are successful for now, unless specific failed state logic is added.
      events.push(terminalEvent);
    }
    
    return events;
  }
}
