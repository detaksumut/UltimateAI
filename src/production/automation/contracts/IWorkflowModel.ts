/**
 * IWorkflowModel.ts
 *
 * Immutable definition of a Workflow.
 * Represents the 5 core primitives: Trigger, State, Action, Transition.
 * (Audit is the output, handled separately).
 */

export interface IWorkflowModel {
  readonly id: string;
  readonly version: string;
  
  readonly trigger: IWorkflowTrigger;
  readonly states: ReadonlyArray<string>;
  readonly actions: ReadonlyArray<string>;
  readonly transitions: ReadonlyArray<IWorkflowTransition>;
}

export interface IWorkflowTrigger {
  readonly event: string;
}

export interface IWorkflowTransition {
  readonly from: string;
  readonly action: string;
  readonly to: string;
}
