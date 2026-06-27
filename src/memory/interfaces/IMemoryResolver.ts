// src/memory/interfaces/IMemoryResolver.ts

import { MemoryAddress } from "../types/MemoryAddress";
import { IMemoryProvider } from "./IMemoryProvider";

/** Minimal resolver interface for memory providers */
export interface IMemoryResolver {
  /** Resolve a provider based on a memory address */
  resolve(address: MemoryAddress): IMemoryProvider;
}
