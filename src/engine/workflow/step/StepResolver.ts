// src/engine/workflow/step/StepResolver.ts
import { IStepResolver } from './IStepResolver';
import { IHandlerRegistry } from './IHandlerRegistry';
import { WorkflowStep } from '../types/WorkflowStep';
import { IStepHandler } from './IStepHandler';

/**
 * Concrete resolver that maps a WorkflowStep to its registered IStepHandler.
 */
export class StepResolver implements IStepResolver {
  constructor(private readonly handlerRegistry: IHandlerRegistry) {}

  resolve(step: WorkflowStep): IStepHandler {
    // The step's `action` property is the namespaced identifier.
    return this.handlerRegistry.resolve(step.action);
  }
}
