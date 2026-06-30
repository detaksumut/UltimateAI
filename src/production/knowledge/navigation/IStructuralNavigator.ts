// src/production/knowledge/navigation/IStructuralNavigator.ts

import { KnowledgeAnchor } from "./KnowledgeAnchor";
import { NavigationContext } from "./NavigationContext";
import { NavigationResult } from "./NavigationResult";

/**
 * Traverses the Knowledge Graph strictly by following explicit edges.
 * Used for direct structural queries (e.g., getting immediate dependencies, parent-child links).
 */
export interface IStructuralNavigator {
  findAncestors(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
  findDescendants(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
  findNeighbors(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
  findLatestVersion(anchor: KnowledgeAnchor, context: NavigationContext): Promise<NavigationResult>;
}
