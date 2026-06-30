// src/production/evolution/IKnowledgeGraphUpdater.ts

import { GraphOperation } from "./GraphOperation";
import { EvolutionContext } from "./EvolutionContext";

export interface IKnowledgeGraphUpdater {
  /**
   * Applies the approved graph updates physically to the KnowledgeGraph.
   */
  updateGraph(updates: readonly GraphOperation[], context: EvolutionContext): Promise<void>;
}
