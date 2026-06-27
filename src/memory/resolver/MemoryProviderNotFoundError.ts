// src/memory/resolver/MemoryProviderNotFoundError.ts

/**
 * Error thrown when a memory provider cannot be resolved for a given address.
 */
export class MemoryProviderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryProviderNotFoundError";
    // Ensure the prototype chain is correctly set for custom error extension in TS/ES5 target
    Object.setPrototypeOf(this, MemoryProviderNotFoundError.prototype);
  }
}
