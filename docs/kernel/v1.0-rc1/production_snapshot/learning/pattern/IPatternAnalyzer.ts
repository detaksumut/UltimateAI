// src/production/learning/pattern/IPatternAnalyzer.ts

import { Experience } from "../experience/Experience";
import { LearningPattern } from "./LearningPattern";

import { PatternAnalysisResult } from "./PatternAnalysisResult";

/**
 * The first AI-driven stage in the Learning Pipeline.
 * Receives deterministic Experiences and utilizes AI reasoning to identify underlying patterns.
 */
export interface IPatternAnalyzer {
  /**
   * Analyzes a set of experiences to discover and classify recurring themes.
   */
  analyze(experiences: readonly Experience[]): Promise<PatternAnalysisResult>;
}
