/**
 * Represents a single execution lifecycle within the Production Kernel.
 * All fields are immutable to ensure reliable auditability.
 */
export interface ExecutionSession {
  readonly id: string;
  /** Current status of the session */
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly startedAt: Date;
  readonly finishedAt?: Date;
  /** Optional log entries */
  readonly logs?: readonly string[];
}
