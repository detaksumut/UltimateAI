// src/memory/interfaces/IMemoryProvider.ts

import { MemoryNamespace } from "../types/MemoryNamespace";
import { MemoryRole } from "../types/MemoryRole";

export interface MemoryProviderDescriptor {
  readonly id: string;
  readonly namespace: MemoryNamespace;
  readonly role: MemoryRole;
}

/** Interface for a memory provider */
export interface IMemoryProvider {
  /** The metadata descriptor for this memory provider */
  readonly descriptor: MemoryProviderDescriptor;
  /** Generic operation signature placeholder */
  [operation: string]: any;
}
