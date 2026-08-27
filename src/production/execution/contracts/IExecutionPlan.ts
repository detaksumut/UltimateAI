/**
 * IExecutionPlan.ts
 *
 * The compiled, purely executable graph representation.
 * The WorkflowModel (design artifact) is stripped and converted into this plan by the Adapter.
 */

export interface IExecutionNode {
  readonly state_id: string;
  readonly is_terminal: boolean;
}

export interface IExecutionEdge {
  readonly from_state: string;
  readonly action: string;
  readonly to_state: string;
}

export interface IExecutionPlan {
  readonly plan_id: string;
  readonly initial_state: string;
  readonly nodes: IExecutionNode[];
  readonly edges: IExecutionEdge[];
}
