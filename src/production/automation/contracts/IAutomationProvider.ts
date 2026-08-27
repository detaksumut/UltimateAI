/**
 * IAutomationProvider.ts
 *
 * Represents a generic automation provider (e.g., 'native', 'n8n', 'temporal').
 */

export interface IAutomationCapabilityMatrix {
  readonly supportsWebhook: boolean;
  readonly supportsSchedule: boolean;
  readonly supportsHumanTask: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsCompensation: boolean; // Saga Pattern
  readonly supportsTransactions: boolean;
  readonly supportsLongRunningWorkflow: boolean;
  readonly supportsApprovalWorkflow: boolean;
  readonly supportsParallelExecution: boolean;
  readonly supportsConditionalBranch: boolean;
  readonly supportsSubWorkflow: boolean;
  readonly supportsEventSubscription: boolean;
}

export interface IAutomationProvider {
  readonly providerId: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: IAutomationCapabilityMatrix;
}
