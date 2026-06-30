// src/production/knowledge/navigation/TraversalStrategy.ts

/**
 * High-level strategies for navigating the Knowledge Graph.
 * Abstracted away from graph traversal queries.
 */
export enum TraversalStrategy {
  BREADTH_FIRST = "BREADTH_FIRST",
  DEPTH_FIRST = "DEPTH_FIRST",
  TIMELINE = "TIMELINE",    // Chronological/Sequential traversal based on semantic relationships
  VERSION = "VERSION",      // Following Version relations like SUPERSEDES or DERIVED_FROM
  CORRELATION = "CORRELATION" // Traversal strictly bounded by a specific correlationId trace
}
