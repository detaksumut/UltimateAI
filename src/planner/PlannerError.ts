// src/planner/PlannerError.ts

/**
 * Domain‑specific error type for the planning subsystem.
 */
export class PlannerError extends Error {
  /** A short error code identifying the error category. */
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlannerError';
    this.code = code;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, PlannerError.prototype);
  }
}
