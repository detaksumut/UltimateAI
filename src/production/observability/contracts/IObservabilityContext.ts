/**
 * IObservabilityContext.ts
 *
 * Wraps the raw ExecutionEvent with platform and environment metadata.
 * Sent to all observability consumers.
 */

import { IExecutionEvent } from '../../execution/contracts/IExecutionEvent';

export interface IObservabilityContext {
  readonly environment: string; // e.g. 'production', 'staging'
  readonly node_id: string;
  readonly service_version: string;
  readonly correlation_id?: string;
  
  readonly event: IExecutionEvent;
}
