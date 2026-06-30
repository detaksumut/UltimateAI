// src/production/knowledge/reconstruction/ReconstructionResult.ts

import { KnowledgePath } from "../contracts/KnowledgePath";
import { KnowledgeSnapshot } from "./KnowledgeSnapshot";
import { KnowledgeTimeline } from "./KnowledgeTimeline";
import { ReconstructionMetrics } from "./ReconstructionMetrics";
import { ReconstructionWarning } from "./ReconstructionWarning";
import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";

/**
 * A perfectly reconstructed slice of history.
 * Serves as the deterministic ground-truth foundation before AI learning begins.
 */
export interface ReconstructionResult extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  readonly reconstructionId: string;
  
  /** The ID of the original execution log this reconstruction is based on */
  readonly sourceLogId: string;
  
  // (In reality, there would be Snapshots, Timelines, or Paths here)
  readonly extractedFacts: readonly string[];
  
  readonly reconstructedAt: number;

  /** The specific traversal path representing the reconstruction */
  readonly path: KnowledgePath;
  
  /** Present if mode was SNAPSHOT or EXPLAIN */
  readonly snapshot?: KnowledgeSnapshot;
  
  /** Present if mode was TIMELINE or BRANCH */
  readonly timeline?: KnowledgeTimeline;
  
  readonly metrics: ReconstructionMetrics;
  readonly warnings: readonly ReconstructionWarning[];
}
