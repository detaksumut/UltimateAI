// src/engine/workflow/step/IStepResolver.ts
import { WorkflowStep } from '../types/WorkflowStep';
import { IStepHandler } from './IStepHandler';

/**
 * Resolver that maps a declarative WorkflowStep to a concrete IStepHandler.
 * Returns a handler capable of executing the step. The resolution is based on
 * the step's `action` identifier and the underlying IHandlerRegistry.
 */
export interface IStepResolver {
  /** Resolve a step to its handler */
  resolve(step: WorkflowStep): IStepHandler;
}
