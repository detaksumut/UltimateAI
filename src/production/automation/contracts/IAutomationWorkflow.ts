/**
 * IAutomationWorkflow.ts
 *
 * Defines the logical structure of an automation workflow (Internal DSL).
 * Decoupled from the manifest metadata.
 */

export interface IAutomationWorkflow {
  /**
   * The condition or event that triggers this workflow block.
   */
  readonly when: {
    readonly event_type: string;
    readonly condition?: string; // Optional JMESPath or logical expression
  };
  
  /**
   * The sequence of actions to execute if the condition is met.
   */
  readonly then: ReadonlyArray<IAutomationAction>;
}

export interface IAutomationAction {
  readonly action_type: string; // e.g., 'send_email', 'generate_certificate'
  readonly parameters: Record<string, any>;
  readonly next?: IAutomationAction[];
}
