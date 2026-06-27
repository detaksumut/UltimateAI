// src/execution/models/ExecutionResult.ts

import { ExecutionMetrics } from "./ExecutionMetrics";

/**
 * Model representing the result of execution.
 * This model is immutable.
 *
 * Future compatibility:
 * - streaming execution
 * - partial results
 * - checkpoint / resume
 * - distributed execution
 * - telemetry
 * New optional fields can be added without breaking the public contract.
 */
export interface ExecutionResult {
  /** Indicates if the execution completed successfully without unhandled errors */
  readonly success: boolean;
  /** Map of task ID to execution outputs */
  readonly outputs: Readonly<Record<string, unknown>>;
  /** Execution performance and status metrics */
  readonly metrics: ExecutionMetrics;
  /** List of errors encountered during execution, if any */
  readonly errors?: readonly Error[];
  /** Optional metadata for future extensions */
  readonly metadata?: Readonly<{
    /** Unique identifier for this execution instance */
    executionId?: string;
    /** Trace identifier for distributed tracing */
    traceId?: string;
    /** Non‑critical warnings */
    warnings?: readonly string[];
    /** Diagnostic messages */
    diagnostics?: readonly string[];
    /** Execution start timestamp */
    startedAt?: Date;
    /** Execution finish timestamp */
    finishedAt?: Date;
  }>;
}
