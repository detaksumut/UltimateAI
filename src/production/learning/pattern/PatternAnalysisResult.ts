// src/production/learning/pattern/PatternAnalysisResult.ts

import { LearningPattern } from "./LearningPattern";

/**
 * The output of the PatternAnalyzer.
 */
export interface PatternAnalysisResult {
  readonly patterns: readonly LearningPattern[];
  readonly warnings: readonly string[];
  readonly durationMs: number;
}
