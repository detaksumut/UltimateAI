// src/production/logger/LogCategory.ts
/**
 * LogCategory – enumeration of log categories used throughout the logging subsystem.
 * Extend as needed for new categories; keep backward‑compatible by preserving existing values.
 */
export enum LogCategory {
  DEFAULT = "DEFAULT",
  SECURITY = "SECURITY",
  PERFORMANCE = "PERFORMANCE",
  AUDIT = "AUDIT",
  DEBUG = "DEBUG",
  // Add additional categories here.
}
