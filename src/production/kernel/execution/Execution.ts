// src/production/kernel/execution/Execution.ts

import { TraceableArtifact } from "../../intelligence/contracts/TraceableArtifact";

/**
 * Immutable representation of the entire execution plan.
 * It is a Directed Acyclic Graph (DAG) composed of Jobs and Tasks.
 * All dependencies are expressed via the `dependsOn` field on each Task.
 */
export interface Execution extends TraceableArtifact {
  /** All jobs that belong to this execution */
  readonly jobs: readonly Job[];
  /** Optional metadata (e.g., trace IDs) */
  readonly metadata?: Record<string, unknown>;
}

// Type‑only import to avoid runtime circular dependencies
import type { Job } from "../task/Job";
