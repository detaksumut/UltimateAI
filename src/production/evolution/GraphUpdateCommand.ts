// src/production/evolution/GraphUpdateCommand.ts

/**
 * A command representing an instruction to update the Knowledge Graph.
 * Ensures the GraphUpdater remains purely passive.
 */
export interface GraphUpdateCommand {
  readonly id: string;
  readonly fromKnowledgeId: string;
  readonly toKnowledgeId: string;
  readonly relationType: "SUPERSEDES" | "REINFORCES" | "EVOLVED_FROM" | "MERGED_FROM" | "SPLIT_FROM" | "CONFLICTS_WITH";
  readonly timestamp: number;
  readonly pipelineId: string;
}
