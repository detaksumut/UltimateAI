// src/production/evolution/IKnowledgeDiscovery.ts

import { EvolutionContext } from "./EvolutionContext";
import { DiscoveryResult } from "./DiscoveryResult";

/**
 * Stage 1 (8G-1): Efficiently discovers existing knowledge that is semantically 
 * relevant to or in conflict with the new knowledge.
 */
export interface IKnowledgeDiscovery {
  /**
   * Returns a narrowed set of existing knowledge candidates from the repository.
   */
  discover(context: EvolutionContext): Promise<DiscoveryResult>;
}
