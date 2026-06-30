// src/production/intelligence/validation/ValidationContext.ts

import { Execution } from "../../kernel/execution/Execution";
import { ProductionContext } from "../../kernel/context/ProductionContext";
import { WorkerMetadata } from "../../infrastructure/registry/RuntimeWorkerRegistry";

/**
 * Shared context provided to all ValidationRules.
 * Contains the execution plan to validate, along with metadata needed
 * to make validation decisions (e.g., registered workers, runtime options).
 */
export interface ValidationContext {
  /** The DAG being validated */
  readonly execution: Execution;
  
  /** The overall production context of the system */
  readonly productionContext?: ProductionContext;
  
  /** List of available workers and their capabilities */
  readonly availableWorkers?: readonly WorkerMetadata[];
  
  /** Specific options governing validation strictness */
  readonly runtimeOptions?: Record<string, unknown>;
}
