// src/production/knowledge/navigation/NavigationWarning.ts

/**
 * Warnings generated during Navigation.
 * Allows consumers like Replay to take action on non-fatal traversal issues.
 */
export interface NavigationWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: "INFO" | "WARNING" | "CRITICAL";
}
