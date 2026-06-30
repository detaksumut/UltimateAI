// src/production/sdk/WorkerResult.ts

/**
 * Result returned by a Worker after execution.
 * This is a generic, provider‑agnostic wrapper — the actual artifact
 * payload can be anything (APK bytes, image URL, generated code, etc.).
 */
export interface WorkerResult {
  /** Whether the worker completed successfully */
  readonly success: boolean;

  /** Optional output data produced by the worker */
  readonly output?: unknown;

  /** Optional human‑readable message (e.g., error description) */
  readonly message?: string;

  /** Optional metrics collected during execution (timing, token usage, etc.) */
  readonly metrics?: Record<string, unknown>;
}
