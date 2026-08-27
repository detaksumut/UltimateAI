// src/production/logger/InvalidCorrelationIdError.ts
/**
 * InvalidCorrelationIdError – thrown by {@link DefaultSerializer} when the
 * injected {@link ICorrelationPolicy} returns an empty, null, undefined, or
 * whitespace‑only correlation identifier.
 *
 * This is a **contract violation** and signals a mis‑behaving correlation
 * policy that must be fixed upstream.
 */
export class InvalidCorrelationIdError extends Error {
  constructor(message?: string) {
    super(message ?? "ICorrelationPolicy returned an invalid correlation identifier.");
    this.name = "InvalidCorrelationIdError";
    // Maintaining proper prototype chain for instanceof checks.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
