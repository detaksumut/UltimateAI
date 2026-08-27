// src/production/logger/DefaultSerializer.ts
/**
 * DefaultSerializer – concrete implementation of {@link ILogSerializer}.
 *
 * Responsibilities:
 *   1. Orchestrate correlation policy via dependency injection.
 *   2. Delegate deterministic canonical serialization to the pure utility function
 *      {@link canonicalSerialize} (static function, no state).
 *   3. Produce an immutable {@link SerializedLog} using the factory
 *      {@link createSerializedLog}.
 *   4. Validate correlation ID – if it is empty, null, undefined, or whitespace‑only,
 *      throw {@link InvalidCorrelationIdError} (contract violation).
 *
 * The class is **stateless** – it only stores the injected {@link ICorrelationPolicy}
 * instance and never mutates the supplied {@link LogEntry}.
 */
import type { ILogSerializer } from "./ILogSerializer";
import type { LogEntry } from "./LogEntry";
import { canonicalSerialize } from "./CanonicalSerializer";
import { createSerializedLog, SerializedLog } from "./SerializedLog";
import type { ICorrelationPolicy } from "./ICorrelationPolicy";
import { InvalidCorrelationIdError } from "./InvalidCorrelationIdError";

export class DefaultSerializer implements ILogSerializer {
  private readonly correlationPolicy: ICorrelationPolicy;

  constructor(correlationPolicy: ICorrelationPolicy) {
    this.correlationPolicy = correlationPolicy;
  }

  /**
   * Validate the correlation identifier. Throws {@link InvalidCorrelationIdError}
   * if the identifier is undefined, null, empty, or consists only of whitespace.
   */
  private validateCorrelationId(id: string | undefined | null): void {
    if (id === undefined || id === null || (typeof id === "string" && id.trim().length === 0)) {
      throw new InvalidCorrelationIdError(
        "ICorrelationPolicy returned an invalid correlation identifier."
      );
    }
  }

  /**
   * Serialize a {@link LogEntry} into a frozen {@link SerializedLog}.
   *
   * - Calls {@link ICorrelationPolicy.computeCorrelationId} exactly once.
   * - Validates the correlation identifier; throws {@link InvalidCorrelationIdError}
   *   if the value is empty, null, undefined, or consists only of whitespace.
   * - Uses {@link canonicalSerialize} (pure function) for payload creation.
   * - Returns an immutable DTO via {@link createSerializedLog}.
   */
  serialize(entry: LogEntry): SerializedLog {
    // Compute correlation identifier (pure, deterministic)
    const correlationId = this.correlationPolicy.computeCorrelationId(entry);
    // Validate correlation identifier – contract violation if invalid
    this.validateCorrelationId(correlationId);
    // Produce deterministic payload
    const payload = canonicalSerialize(entry);
    // Return immutable SerializedLog (factory freezes the object)
    return createSerializedLog(correlationId as string, payload);
  }
}
