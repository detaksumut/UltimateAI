// src/engine/workflow/step/IStepHandler.ts
import { Result } from '../../core/types/Result';
import { HandlerContext } from '../types/HandlerContext';

/**
 * Handler responsible for executing a single workflow step.
 * The interface is deliberately minimal – a single `execute` method that
 * receives a `HandlerContext`. Future extensions (logger, telemetry, etc.)
 * can be added to the context without changing this signature.
 */
export interface IStepHandler {
  /** Optional guard – can be used in later phases */
  supports?(context: HandlerContext): boolean;

  /** Execute the step and return a generic Result */
  execute<T = any, E = any>(context: HandlerContext): Promise<Result<T, E>>;
}
