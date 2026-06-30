// src/production/reasoning/contracts/IReasoningContext.ts

import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";

/**
 * The enriched context passed into the Reasoning Runtime.
 */
export interface IReasoningContext extends IRuntimeContext {
  /** The core problem or question to be reasoned about */
  readonly goal: string;
  
  /** The runtime context of the caller (e.g. PlanningContext or ExecutionContext) */
  readonly callerContext?: Record<string, any>;
  
  /** Any explicit constraints the reasoning must adhere to */
  readonly constraints?: readonly string[];
  
  /** Relevant history or previous attempts related to this goal */
  readonly history?: readonly string[];
  
  /** Mode of reasoning: "ADVISORY" (for internal runtime assistance) or "ANALYTICAL" (for user analysis) */
  readonly mode: "ADVISORY" | "ANALYTICAL";
}
