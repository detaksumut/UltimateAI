// src/production/learning/promotion/KnowledgeOrigin.ts

/**
 * Indicates where this knowledge originated from.
 */
export enum KnowledgeOrigin {
  /** Generated natively by the AI Learning Runtime */
  LEARNING_RUNTIME = "LEARNING_RUNTIME",
  
  /** Entered explicitly by a human user */
  MANUAL = "MANUAL",
  
  /** Imported from an external system or dataset */
  IMPORT = "IMPORT",
  
  /** Hardcoded system rules/axioms */
  SYSTEM = "SYSTEM"
}
