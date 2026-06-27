// src/execution/models/ExecutionContext.ts

import { CancellationToken } from "./CancellationToken";

/**
 * ExecutionContext contains execution-level parameters and cancellation states.
 * All properties are read‑only (immutable).
 */
export interface ExecutionContext {
  readonly executionId: string;
  readonly workflowId: string;
  readonly variables: ReadonlyMap<string, unknown>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly cancellationToken: CancellationToken;
}
