// src/production/execution/logger/IExecutionLogger.ts

import { ExecutionLog, ExecutionLogEntry } from "./ExecutionLog";

/**
 * Manages the append-only log of physical facts.
 */
export interface IExecutionLogger {
  /** Opens a new log for the execution session */
  openLog(executionId: string, blueprintId: string): string;
  
  /** Appends a fact to the log. Must never overwrite. */
  append(logId: string, entry: Omit<ExecutionLogEntry, "timestamp">): void;
  
  /** Retrieves the full log to be passed in the Result */
  getLog(logId: string): ExecutionLog;
}
