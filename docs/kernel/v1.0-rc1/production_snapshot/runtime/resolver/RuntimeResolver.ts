// src/production/runtime/resolver/RuntimeResolver.ts

import { IRuntimeRegistry } from "../registry/RuntimeRegistry";
import { RuntimeCapability } from "../contracts/RuntimeCapability";
import { IRuntime } from "../contracts/IRuntime";

/**
 * Principle 28: Capabilities, Not Implementations.
 * Determines the best runtime to handle a specific capability request.
 */
export interface IRuntimeResolver {
  /**
   * Resolves the best runtime implementation for the given capability.
   */
  resolve(capability: RuntimeCapability): IRuntime<any, any>;
}

export class RuntimeResolverImpl implements IRuntimeResolver {
  constructor(private readonly registry: IRuntimeRegistry) {}

  resolve(capability: RuntimeCapability): IRuntime<any, any> {
    const availableRuntimes = this.registry.supports(capability);
    
    if (availableRuntimes.length === 0) {
      throw new Error(`No runtime registered for capability: ${capability}`);
    }
    
    // For now, simple resolution: return the first one found.
    // In the future, this could use load balancing, versioning, or context-aware matching.
    return availableRuntimes[0];
  }
}
