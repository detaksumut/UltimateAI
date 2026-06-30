// src/production/sdk/WorkerException.ts

/**
 * Custom error class for Worker failures.
 * Carries structured information so the Infrastructure layer and
 * ExecutionSession can decide whether to retry, skip, or abort.
 */
export class WorkerException extends Error {
  /** Machine‑readable error code (e.g., "TIMEOUT", "PROVIDER_UNAVAILABLE") */
  public readonly code: string;

  /** Whether the caller may retry the same task */
  public readonly retriable: boolean;

  /** Optional structured details for diagnostics */
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    retriable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WorkerException";
    this.code = code;
    this.retriable = retriable;
    this.details = details;
  }
}
