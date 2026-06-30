// src/production/providers/contracts/ProviderRequest.ts

import { ProviderCapability } from "./ProviderCapability";

/**
 * A vendor-agnostic request representing the needs of UltimateAI.
 * It does not use vendor-specific terminology (like "messages" or "temperature" specifically),
 * but rather a generalized concept of context, instruction, and options.
 */
export interface ProviderRequest {
  /** Unique request identifier */
  readonly requestId: string;

  /** The primary capability being requested */
  readonly capability: ProviderCapability;

  /** The core instruction or prompt for the AI */
  readonly instruction: string;

  /** Additional context provided to the AI (e.g., conversation history, system prompt) */
  readonly context?: unknown;

  /** Attachments such as images, documents, or data payloads */
  readonly attachments?: readonly unknown[];

  /** Generic options that influence execution (e.g., creativity level, max length) */
  readonly options?: Record<string, unknown>;

  /** Arbitrary metadata associated with this request */
  readonly metadata?: Record<string, unknown>;
}
