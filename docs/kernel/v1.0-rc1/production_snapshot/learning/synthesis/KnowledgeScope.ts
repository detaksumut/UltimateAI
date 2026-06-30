// src/production/learning/synthesis/KnowledgeScope.ts

/**
 * Defines the applicability boundary of a piece of synthesized knowledge.
 * Allows Reasoners and Planners to decide when to apply the knowledge.
 */
export enum KnowledgeScope {
  /** Applies universally across the entire system */
  GLOBAL = "GLOBAL",
  
  /** Applies only to a specific domain (e.g., Code Generation, Architecture) */
  DOMAIN = "DOMAIN",
  
  /** Applies to a specific orchestrational workflow */
  WORKFLOW = "WORKFLOW",
  
  /** Applies to a specific task execution */
  TASK = "TASK",
  
  /** Applies only to the current conversation/session context */
  SESSION = "SESSION"
}
