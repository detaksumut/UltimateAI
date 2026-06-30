// src/production/sdk/WorkerCapability.ts
/**
 * Enumerates the high‑level capabilities a Worker can expose.
 * Layers above the Kernel can use these capabilities to match Workers to
 * requested actions without needing concrete implementation details.
 */
export enum WorkerCapability {
  /** Create new artifacts (e.g., generate APK, image, document) */
  GENERATE = "generate",
  /** Transform or modify existing artifacts */
  TRANSFORM = "transform",
  /** Validate inputs or intermediate results */
  VALIDATE = "validate",
  /** Analyze data or model outputs */
  ANALYZE = "analyze",
  /** Any custom capability – extensions may add more values */
  CUSTOM = "custom",
}
