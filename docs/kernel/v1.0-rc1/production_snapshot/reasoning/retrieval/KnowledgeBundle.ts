// src/production/reasoning/retrieval/KnowledgeBundle.ts

import { LearnedKnowledge } from "../../learning/promotion/LearnedKnowledge";
import { KnowledgeGraphRelation } from "../../evolution/KnowledgeGraphRelation";

/**
 * A cohesive bundle of facts retrieved from the Knowledge Repository and Graph.
 */
export interface KnowledgeBundle {
  /** The core knowledge items retrieved based on semantic similarity */
  readonly primaryKnowledge: readonly LearnedKnowledge[];
  
  /** Related knowledge items discovered by traversing the graph (e.g. successors, conflicts) */
  readonly contextualKnowledge: readonly LearnedKnowledge[];
  
  /** The exact edges connecting these knowledge items */
  readonly relations: readonly KnowledgeGraphRelation[];
}
