// src/production/runtime/contracts/RuntimeCapability.ts

/**
 * Principle 28: Capabilities, Not Implementations.
 * The distinct operational capabilities provided by runtimes.
 */
export enum RuntimeCapability {
  PLANNING = "PLANNING",
  EXECUTION = "EXECUTION",
  KNOWLEDGE = "KNOWLEDGE",
  LEARNING = "LEARNING",
  EVOLUTION = "EVOLUTION",
  REASONING = "REASONING",
  DELIVERY = "DELIVERY"
}
