// src/production/knowledge/reconstruction/ReconstructionWarning.ts

/**
 * Structural warnings discovered during graph reconstruction.
 * Separate from NavigationWarnings, these indicate issues with history completeness.
 */
export interface ReconstructionWarning {
  readonly code: "INCOMPLETE_HISTORY" | "MISSING_VERSION_CHAIN" | "BROKEN_CORRELATION" | "UNKNOWN";
  readonly message: string;
  readonly severity: "INFO" | "WARNING" | "CRITICAL";
}
