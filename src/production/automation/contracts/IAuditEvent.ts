/**
 * IAuditEvent.ts
 *
 * Immutable record of a state transition or workflow event.
 */

export interface IAuditEvent {
  readonly event_id: string;
  readonly workflow_instance_id: string;
  
  readonly who: string;
  readonly when: string;
  readonly action: string;
  readonly what: {
    readonly from_state: string;
    readonly to_state: string;
  };
  readonly correlation_id: string;
}
