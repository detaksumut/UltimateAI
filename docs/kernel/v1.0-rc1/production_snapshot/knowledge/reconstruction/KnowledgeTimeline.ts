// src/production/knowledge/reconstruction/KnowledgeTimeline.ts

import { KnowledgeEvent } from "./KnowledgeEvent";
import { KnowledgeSnapshot } from "./KnowledgeSnapshot";
import { KnowledgePath } from "../contracts/KnowledgePath";

/**
 * A progression of semantic events and snapshots representing a historical flow.
 * Essential for the Replay and Learning capabilities.
 */
export interface KnowledgeTimeline {
  readonly events: readonly KnowledgeEvent[];
  readonly snapshots: readonly KnowledgeSnapshot[];
  
  /** Total timespan covered by this timeline in milliseconds */
  readonly duration: number;
  
  /** The specific traversal path representing this timeline */
  readonly path: KnowledgePath;
}
