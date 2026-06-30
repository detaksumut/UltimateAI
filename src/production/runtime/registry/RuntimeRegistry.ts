// src/production/runtime/registry/RuntimeRegistry.ts

import { IRuntime } from "../contracts/IRuntime";
import { RuntimeCapability } from "../contracts/RuntimeCapability";

/**
 * A passive catalog of all available runtimes.
 * It does not execute them, it only stores their references and descriptors.
 */
export interface IRuntimeRegistry {
  register(runtime: IRuntime<any, any>): void;
  unregister(runtimeId: string): void;
  
  findById(runtimeId: string): IRuntime<any, any> | undefined;
  listAll(): ReadonlyArray<IRuntime<any, any>>;
  
  /** Returns all runtimes that support the requested capability */
  supports(capability: RuntimeCapability): ReadonlyArray<IRuntime<any, any>>;
}

export class RuntimeRegistryImpl implements IRuntimeRegistry {
  private readonly runtimes = new Map<string, IRuntime<any, any>>();

  register(runtime: IRuntime<any, any>): void {
    if (this.runtimes.has(runtime.manifest.id)) {
      throw new Error(`Runtime with id ${runtime.manifest.id} is already registered.`);
    }
    this.runtimes.set(runtime.manifest.id, runtime);
  }

  unregister(runtimeId: string): void {
    this.runtimes.delete(runtimeId);
  }

  findById(runtimeId: string): IRuntime<any, any> | undefined {
    return this.runtimes.get(runtimeId);
  }

  listAll(): ReadonlyArray<IRuntime<any, any>> {
    return Array.from(this.runtimes.values());
  }

  supports(capability: RuntimeCapability): ReadonlyArray<IRuntime<any, any>> {
    return this.listAll().filter(rt => 
      rt.manifest.capabilities.includes(capability)
    );
  }
}
