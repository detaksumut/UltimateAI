// src/production/runtime/registry/RuntimeDescriptor.ts

import { RuntimeCapability } from "../contracts/RuntimeCapability";

/**
 * Metadata describing a registered Runtime.
 */
export interface RuntimeDescriptor {
  /** The unique identifier for this runtime implementation (e.g. 'learning-v1') */
  readonly id: string;
  
  /** The human-readable name */
  readonly name: string;
  
  /** The version of this runtime */
  readonly version: string;
  
  /** The primary capabilities this runtime provides */
  readonly capabilities: readonly RuntimeCapability[];
}
