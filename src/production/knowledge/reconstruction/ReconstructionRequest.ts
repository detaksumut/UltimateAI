// src/production/knowledge/reconstruction/ReconstructionRequest.ts

import { KnowledgeAnchor } from "../navigation/KnowledgeAnchor";
import { NavigationContext } from "../navigation/NavigationContext";
import { ReconstructionMode } from "./ReconstructionMode";
import { ReconstructionPolicy } from "./ReconstructionPolicy";

/**
 * The payload requesting a specific graph reconstruction.
 */
export interface ReconstructionRequest {
  readonly anchor: KnowledgeAnchor;
  readonly mode: ReconstructionMode;
  readonly policy: ReconstructionPolicy;
  readonly context: NavigationContext;
  
  /** An optional boundary state ID to stop reconstruction (e.g., an execution ID) */
  readonly targetState?: string;
}
