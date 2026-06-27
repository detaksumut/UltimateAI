// src/engine/workflow/step/IHandlerRegistry.ts
import { IStepHandler } from './IStepHandler';

/**
 * Registry for step handlers. Stores concrete IStepHandler instances keyed by
 * a namespaced action identifier (e.g. "tool/filesystem/read").
 * Only `register` and `resolve` are required for the current phase; other
 * methods are declared for future expansion.
 */
export interface IHandlerRegistry {
  /** Register a handler for a given identifier */
  register(id: string, handler: IStepHandler): void;

  /** Resolve a handler – throws if not found */
  resolve(id: string): IStepHandler;

  /** Optional future methods */
  has?(id: string): boolean;
  list?(): string[];
  unregister?(id: string): void;
}
