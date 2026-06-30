// src/production/knowledge/navigation/ISemanticNavigator.ts

import { KnowledgeAnchor } from "./KnowledgeAnchor";
import { NavigationContext } from "./NavigationContext";
import { NavigationResult } from "./NavigationResult";

/**
 * Interprets the Knowledge Graph semantically.
 * Instead of just following raw edges, it infers high-level domain concepts
 * like "Timeline of a decision" or "Correlation trace".
 * Essential for the Learning and Replay engines.
 */
export interface ISemanticNavigator {
  /**
   * Reconstructs the timeline based on semantic relationships
   * (e.g., GENERATED -> VALIDATED -> CRITIQUED), independent of pure chronological timestamps.
   */
  findTimeline(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
  
  /**
   * Finds the path that represents how a final decision was reached.
   */
  findDecisionPath(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
  
  /**
   * Explores the full end-to-end chain of artifacts sharing a single correlation.
   */
  findCorrelationChain(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
}
