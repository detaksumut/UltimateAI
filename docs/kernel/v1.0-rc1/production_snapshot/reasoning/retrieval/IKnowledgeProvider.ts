// src/production/reasoning/retrieval/IKnowledgeProvider.ts

import { IReasoningContext } from "../contracts/IReasoningContext";
import { KnowledgeBundle } from "./KnowledgeBundle";

/**
 * Stage 1: Retrieval.
 * Fetches relevant knowledge and graph traversal data without performing any AI inference.
 */
export interface IKnowledgeProvider {
  /**
   * Translates the reasoning goal into a query and fetches the KnowledgeBundle.
   */
  provide(context: IReasoningContext): Promise<KnowledgeBundle>;
}
