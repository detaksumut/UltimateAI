// src/execution/models/ExecutionOptions.ts

import { ExecutionMode } from "./ExecutionMode";
import { RetryPolicy } from "../retry/models/RetryPolicy";
import { TimeoutPolicy } from "./TimeoutPolicy";

/**
 * Execution Options specifying retry, timeout, concurrency mode, fail-fast and parallelism limits.
 * This model is immutable and all fields are optional.
 */
export interface ExecutionOptions {
  readonly executionMode?: ExecutionMode;
  readonly retryPolicy?: RetryPolicy;
  readonly timeoutPolicy?: TimeoutPolicy;
  readonly failFast?: boolean;
  readonly maxParallelism?: number;
}
