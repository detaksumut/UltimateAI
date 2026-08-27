/**
 * IAutomationEvent.ts
 *
 * Defines the v1.0 standard payload for all automation events in UltimateAI.
 * 
 * Constitutional Rules:
 * - Event Immutability: Payloads cannot be modified by runtime adapters.
 * - Catalog Governance: `event_type` must correspond to a registered event in catalog/index.yaml.
 */

export interface IAutomationEvent<TPayload = any, TMetadata = any> {
  /**
   * MUST ALWAYS be "1.0" for strict versioning and backward compatibility.
   */
  readonly spec_version: "1.0";
  
  readonly event_id: string;
  
  /**
   * Follows strict taxonomy: <context>.<action>
   * Example: 'journal.submitted', 'membership.approved'
   * Must exactly match an entry in the Event Catalog.
   */
  readonly event_type: string;
  
  /**
   * Identifies the specific domain that emitted the event.
   * Maintains strict boundary between Business Domain and Automation.
   */
  readonly domain: string;
  
  readonly aggregate_type?: string;
  readonly aggregate_id?: string;
  
  readonly workspace_id?: string;
  readonly tenant_id?: string;
  readonly app_id?: string;
  
  readonly correlation_id?: string;
  readonly causation_id?: string;
  
  readonly timestamp: string;
  
  readonly actor?: Record<string, any>;
  
  /**
   * The actual event payload. Must adhere to the `payload_schema` defined in the Event Catalog.
   * This is entirely Immutable.
   */
  readonly payload: Readonly<TPayload>;
  
  readonly metadata?: Readonly<TMetadata>;
}
