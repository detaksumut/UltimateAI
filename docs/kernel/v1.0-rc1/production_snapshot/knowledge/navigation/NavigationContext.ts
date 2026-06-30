// src/production/knowledge/navigation/NavigationContext.ts

import { TraversalStrategy } from "./TraversalStrategy";
import { NavigationMode } from "./NavigationMode";
import { KnowledgeRelationType } from "../contracts/KnowledgeRelationType";
import { KnowledgeNodeType } from "../contracts/KnowledgeNodeType";

/**
 * Configuration payload for a specific navigation traversal.
 */
export interface NavigationContext {
  readonly strategy?: TraversalStrategy;
  readonly mode?: NavigationMode;
  
  readonly maxDepth?: number;
  readonly maxResults?: number;
  
  readonly relationFilter?: readonly KnowledgeRelationType[];
  readonly nodeFilter?: readonly KnowledgeNodeType[];
  
  readonly includeMetadata?: boolean;
  readonly includeVersions?: boolean;
  readonly includeCorrelation?: boolean;
}
