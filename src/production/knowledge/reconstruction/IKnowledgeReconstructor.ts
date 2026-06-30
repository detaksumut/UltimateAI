// src/production/knowledge/reconstruction/IKnowledgeReconstructor.ts

import { ReconstructionRequest } from "./ReconstructionRequest";
import { ReconstructionResult } from "./ReconstructionResult";

/**
 * The Knowledge Reconstruction Engine.
 * Deterministically rebuilds historical graphs, timelines, and branches
 * entirely by orchestrating the Knowledge Navigation Layer.
 * Employs zero AI and zero heuristical logic.
 */
export interface IKnowledgeReconstructor {
  reconstruct(request: ReconstructionRequest): Promise<ReconstructionResult>;
}
