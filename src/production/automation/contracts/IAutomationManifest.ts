/**
 * IAutomationManifest.ts
 *
 * Defines the operational and business metadata for a workflow deployment.
 * Split into two layers as per EAEP v1.0 specifications.
 */

export interface IOperationalManifest {
  readonly runtime: string; // e.g. "native", "temporal", "n8n"
  readonly retry?: {
    readonly max_attempts: number;
    readonly timeout_ms: number;
  };
  readonly credential_requirements?: string[];
  readonly capabilities_required?: string[];
}

export interface IBusinessManifest {
  readonly manifest_id: string; // New: Unique ID
  readonly workflow_id: string;
  readonly workflow_model_version: string; // New: Distinct from schema version
  readonly generator_version: string; // New: Tracking generator evolution
  readonly schema_version: string; // New: Manifest format version
  readonly created_at: string;
  
  readonly domain: string;
  readonly owner: string;
  readonly visibility: 'public' | 'private' | 'internal';
  readonly compatibility?: string[];
  readonly requires?: string[];
  readonly provides?: string[];
}

export interface IAutomationManifest {
  readonly business: IBusinessManifest;
  readonly operational: IOperationalManifest;
}
