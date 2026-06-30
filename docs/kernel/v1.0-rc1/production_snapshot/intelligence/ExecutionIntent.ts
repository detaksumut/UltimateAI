import { TraceableArtifact } from "./contracts/TraceableArtifact";

/**
 * Representation of the system's intent after reasoning has processed the user request.
 * This separates "understanding what needs to be built" from "how to build it" (Execution DAG).
 */
export interface ExecutionIntent extends TraceableArtifact {
  /** The specific objectives the system must achieve */
  readonly goals: readonly string[];
  
  /** Technical or business limitations that must be adhered to */
  readonly constraints: readonly string[];
  
  /** Explicit assumptions made by the reasoning engine, avoiding hidden hallucinations */
  readonly explicitAssumptions: readonly string[];
  
  /** The most important priorities (e.g., "Maintainability", "Performance") */
  readonly priorities: readonly string[];
}
