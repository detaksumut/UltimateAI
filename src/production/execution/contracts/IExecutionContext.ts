/**
 * IExecutionContext.ts
 *
 * Split into Immutable Metadata and Mutable State to support strict audit trails.
 */

import { IExecutionPolicy } from './IExecutionPolicy';

export interface IExecutionMetadata {
  readonly execution_id: string;
  readonly workflow_id: string;
  readonly package_version: string;
  readonly trace_id: string;
  readonly correlation_id?: string;
  readonly actor: string;
  readonly created_at: string;
  readonly policy: IExecutionPolicy; // Immutable policy
}

export interface IExecutionState {
  current_state: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  variables: Record<string, any>;
  readonly history: string[]; // Log of transitions
  retry_count: number; // Mutable state tracking retries
  completed_at?: string;
}

export interface IExecutionContext {
  readonly metadata: IExecutionMetadata;
  readonly state: IExecutionState;
}
