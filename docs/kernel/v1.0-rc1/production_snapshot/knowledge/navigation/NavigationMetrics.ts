// src/production/knowledge/navigation/NavigationMetrics.ts

/**
 * Performance and observability metrics for a Navigation traversal.
 * Essential for the future Optimization Engine and Learning Engine.
 */
export interface NavigationMetrics {
  readonly durationMs: number;
  readonly expandedNodes: number;
  readonly expandedEdges: number;
  readonly prunedNodes: number;
}
