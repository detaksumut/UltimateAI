// src/production/logger/LogEntry.ts
/**
 * LogEntry – core representation of a logging event.
 * All fields are immutable (readonly) and additive.
 * New optional fields introduced for correlation and metadata do not break existing consumers.
 */
export interface LogEntry {
  /** Unix epoch timestamp in milliseconds */
  readonly timestamp: number;
  /** Log type identifier, e.g., "TASK_STARTED" */
  readonly type: string;
  /** Identifier of the entity (task, workflow, etc.) that generated the log */
  readonly entityId: string;
  /** Arbitrary payload associated with the event */
  readonly payload: any;
  // Correlation identifiers – optional and additive.
  readonly requestId?: string;
  readonly workflowId?: string;
  readonly parentId?: string;
  // Metadata added in Step 1.3 – optional and additive.
  readonly category?: LogCategory;
  readonly contractVersion?: string;
  readonly logSchema?: string;
}

/**
 * LogCategory – enumeration of log categories used throughout the logging subsystem.
 */
export enum LogCategory {
  DEFAULT = "DEFAULT",
  SECURITY = "SECURITY",
  PERFORMANCE = "PERFORMANCE",
  AUDIT = "AUDIT",
  DEBUG = "DEBUG",
  // Extend as needed.
}
