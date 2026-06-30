// src/production/knowledge/navigation/NavigationMode.ts

/**
 * Controls the strictness of the Navigation traversal.
 */
export enum NavigationMode {
  /** Only follows edges that strictly adhere to all context filters. */
  STRICT = "STRICT",
  
  /** Allows traversing through intermediate non-matching edges if necessary to find deeper matches. */
  RELAXED = "RELAXED"
}
