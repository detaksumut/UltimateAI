// src/production/knowledge/projection/KnowledgeProjectionType.ts

/**
 * Defines how an artifact is projected into the Knowledge Runtime.
 * Decoupled from the artifact's class name and the engine that generated it.
 */
export enum KnowledgeProjectionType {
  EXECUTION_INTENT = "EXECUTION_INTENT",
  EXECUTION = "EXECUTION",
  VALIDATION_REPORT = "VALIDATION_REPORT",
  CRITIC_EVALUATION = "CRITIC_EVALUATION",
  REFLECTION_DECISION = "REFLECTION_DECISION",
  EXECUTION_CHANGESET = "EXECUTION_CHANGESET",
  REPAIR_ACTION = "REPAIR_ACTION",
  PIPELINE_RESULT = "PIPELINE_RESULT"
}
