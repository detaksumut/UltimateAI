import { IToolDescriptor } from '../interfaces/IToolDescriptor';
import { IAgentDescriptor } from '../interfaces/IAgentDescriptor';

/**
 * Immutable snapshot of the runtime state needed for planning.
 */
export interface PlanningContext {
  readonly tools: IToolDescriptor[];
  readonly agents: IAgentDescriptor[];
  // Additional extensible properties can be added without breaking compatibility.
  readonly [key: string]: any;
}
