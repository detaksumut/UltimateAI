/**
 * IExecutionResult.ts
 *
 * The strict result type emitted by the Kernel to the Post-Execution Pipeline.
 */

export type ExecutionResultType = 'SUCCESS' | 'RETRYABLE_FAILURE' | 'TERMINAL_FAILURE';

export interface IExecutionResult {
  readonly status: ExecutionResultType;
  readonly message: string;
  readonly error?: any;
}
