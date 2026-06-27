// Workflow interfaces
import { WorkflowState } from '../types/WorkflowState';
import { WorkflowEvent } from '../types/WorkflowEvent';
import { WorkflowDefinition } from '../types/WorkflowDefinition';
import { RetryStrategy } from '../types/RetryStrategy';
import { WorkflowContext } from '../types/WorkflowContext';
import { WorkflowResult } from '../types/WorkflowResult';

/**
 * State machine for workflow state transitions.
 */
export interface IWorkflowStateMachine {
  /**
   * Determines the next state based on current state and an event.
   * Implementations must be pure and side‑effect free.
   */
  transition(current: WorkflowState, event: WorkflowEvent): WorkflowState;
}
/**
 * Registry for workflow definitions.
 */
export interface IWorkflowRegistry {
  /** Register a workflow definition. */
  register(definition: WorkflowDefinition): void;
  /** Retrieve a definition by id. */
  get(id: string): WorkflowDefinition | undefined;
  /** List all registered definitions. */
  list(): WorkflowDefinition[];
}
/**
 * Event bus for publishing workflow events.
 */
export interface IWorkflowEventBus {
  /** Publish an event to subscribers. */
  publish(event: WorkflowEvent): void;
  /** Subscribe to events. Returns unsubscribe function. */
  subscribe(listener: (event: WorkflowEvent) => void): () => void;
}
/**
 * Manager for cancellation using AbortSignal.
 */
export interface ICancellationManager {
  /** AbortSignal to be passed to steps. */
  signal: AbortSignal;
  /** Abort the current workflow. */
  abort(): void;
}
/**
 * Executor handling retry logic according to a strategy.
 */
export interface IRetryExecutor {
  /** Execute a function with retry strategy. */
  execute<T>(fn: () => Promise<T>, strategy: RetryStrategy): Promise<T>;
}
/**
 * Runner orchestrates workflow execution.
 */
export interface IWorkflowRunner {
  /** Run a workflow by definition id with optional context. */
  run(definitionId: string, context?: Partial<WorkflowContext>): Promise<WorkflowResult>;
}
