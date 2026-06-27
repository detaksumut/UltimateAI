/**
 * Memory request contract used throughout the memory subsystem.
 *
 * Primary fields are required for operation routing and addressing.
 * All additional fields are optional to maintain backward compatibility.
 */
import { MemoryAddress } from './MemoryAddress';
import { MemoryOperation } from './MemoryOperation';

export interface MemoryRequest {
  /** Which operation to perform */
  operation: MemoryOperation;

  /** Target address (namespace, role, path, etc.) */
  address: MemoryAddress;

  /** Optional payload for put‑type operations */
  payload?: unknown;

  /** Optional opaque metadata that callers may attach */
  metadata?: Record<string, unknown>;

  /** Identifier for distributed tracing */
  traceId?: string;

  /** AbortSignal to support cancellation */
  signal?: AbortSignal;

  /** Arbitrary context (e.g., user, session) */
  context?: Record<string, unknown>;

  /** Feature flags that may affect provider selection */
  flags?: string[];
}
