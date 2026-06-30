// src/production/runtime/registry/RuntimeManifest.ts

import { RuntimeCapability } from "../contracts/RuntimeCapability";

/**
 * Rich metadata describing a registered Runtime.
 * Replaces the simpler RuntimeDescriptor for production readiness.
 */
export interface RuntimeManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  
  readonly capabilities: readonly RuntimeCapability[];
  readonly requiredCapabilities: readonly RuntimeCapability[];
  
  readonly contractVersion: string;
  readonly startupPriority: number;
  
  /** Evaluates if the runtime is healthy and ready to accept requests */
  readonly healthCheck: () => Promise<boolean>;
}
