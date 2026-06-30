import { RuntimeLifecycle } from "./RuntimeLifecycle";
import { IArtifact } from "./IArtifact";

/**
 * Information about a single warning that occurred during execution.
 */
export interface RuntimeWarning {
  readonly code: string;
  readonly message: string;
}

/**
 * Standardized metrics returned by every runtime.
 */
export interface RuntimeMetrics {
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly durationMs: number;
}

/**
 * The standard response payload from any Runtime execution.
 * Enforces that the core payload MUST be a formally traced IArtifact.
 */
export interface IRuntimeResult<T extends IArtifact = IArtifact> {
  readonly runtimeId: string;
  
  readonly status: "SUCCESS" | "PARTIAL" | "FAILURE";
  
  /** The rigorously traced and immutable artifact produced by this runtime */
  readonly payload: T;
  
  readonly warnings: readonly string[]; // Keeping the string array for backward compat with our mock runtime tests for now
  
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly durationMs: number;
}
