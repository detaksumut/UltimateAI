// src/production/reasoning/context/IContextBuilder.ts

import { IReasoningContext } from "../contracts/IReasoningContext";
import { KnowledgeBundle } from "../retrieval/KnowledgeBundle";
import { ReasoningPrompt } from "./ReasoningPrompt";

/**
 * Stage 2: Context Building.
 * Transforms the raw retrieved KnowledgeBundle into a highly structured ReasoningPrompt.
 */
export interface IContextBuilder {
  build(context: IReasoningContext, bundle: KnowledgeBundle): Promise<ReasoningPrompt>;
}
