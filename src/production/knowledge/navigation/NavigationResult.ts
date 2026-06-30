// src/production/knowledge/navigation/NavigationResult.ts

import { KnowledgePath } from "../contracts/KnowledgePath";
import { NavigationMetrics } from "./NavigationMetrics";
import { NavigationWarning } from "./NavigationWarning";

/**
 * The immutable output of any Knowledge Navigation traversal.
 */
export interface NavigationResult {
  readonly paths: readonly KnowledgePath[];
  readonly metrics: NavigationMetrics;
  readonly warnings: readonly NavigationWarning[];
}
