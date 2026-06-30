/**
 * IClock — Deterministic time abstraction.
 *
 * Domain and application layers MUST use this interface
 * instead of calling Date.now() or new Date() directly.
 * Infrastructure provides the concrete SystemClock implementation.
 */
export interface IClock {
  /** Returns current timestamp in milliseconds since epoch. */
  now(): number;
}
