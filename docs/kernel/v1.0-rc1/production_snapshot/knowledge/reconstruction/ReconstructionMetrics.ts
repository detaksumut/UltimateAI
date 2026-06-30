// src/production/knowledge/reconstruction/ReconstructionMetrics.ts

import { NavigationMetrics } from "../navigation/NavigationMetrics";

/**
 * Performance and observability metrics specific to the Reconstruction process.
 */
export interface ReconstructionMetrics {
  /** The underlying traversal metrics */
  readonly navigation: NavigationMetrics;
  
  readonly snapshotCount: number;
  readonly timelineLength: number;
  readonly reconstructionDepth: number;
}
