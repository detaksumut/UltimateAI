// src/production/learning/synthesis/PatternCluster.ts

import { LearningPattern } from "../pattern/LearningPattern";

/**
 * An intermediate grouping of LearningPatterns that are semantically related.
 * Prevents "knowledge explosion" by forcing AI to synthesize related patterns together.
 */
export interface PatternCluster {
  readonly id: string;
  readonly theme: string;
  readonly patterns: readonly LearningPattern[];
}
