// src/memory/interfaces/IMemoryRegistry.ts

import { IMemoryProvider } from "./IMemoryProvider";
import { MemoryNamespace } from "../types/MemoryNamespace";
import { MemoryRole } from "../types/MemoryRole";

/** Interface for memory provider registry */
export interface IMemoryRegistry {
  /** Register a new memory provider */
  register(provider: IMemoryProvider): void;
  /** Unregister a memory provider by its ID */
  unregister(providerId: string): void;
  /** Resolve a provider by its ID */
  resolve(providerId: string): IMemoryProvider | undefined;
  /** List all registered memory providers */
  list(): IMemoryProvider[];
  /** Find memory providers by namespace and role */
  findByNamespaceAndRole(namespace: MemoryNamespace, role: MemoryRole): readonly IMemoryProvider[];
}
