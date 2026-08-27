/**
 * IDeadLetterQueue.ts
 *
 * Defines the contract for the Digital Graveyard (DLQ).
 * Stores executions that failed terminal verification or exhausted retries.
 */

import { IExecutionContext } from '../contracts/IExecutionContext';
import { IExecutionPackage } from '../contracts/IExecutionPackage';

export interface IDLQRecord {
  readonly dlq_id: string;
  readonly execution_id: string;
  readonly timestamp: string;
  readonly failure_reason: string;
  readonly failure_category: 'TIMEOUT' | 'EXHAUSTED_RETRIES' | 'TERMINAL_ERROR' | 'UNKNOWN';
  
  readonly context: IExecutionContext;
  readonly package_snapshot: IExecutionPackage; // Ensures we know EXACTLY what code ran
}

export interface IDeadLetterQueue {
  push(record: Omit<IDLQRecord, 'dlq_id' | 'timestamp'>): IDLQRecord;
  get(dlqId: string): IDLQRecord | undefined;
  list(executionId?: string): IDLQRecord[];
}
