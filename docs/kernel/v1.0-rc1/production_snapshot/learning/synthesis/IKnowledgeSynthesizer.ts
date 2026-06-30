// src/production/learning/synthesis/IKnowledgeSynthesizer.ts

import { LearningPattern } from "../pattern/LearningPattern";
import { PatternCluster } from "./PatternCluster";
import { KnowledgeHypothesis } from "./KnowledgeHypothesis";
import { KnowledgeCandidate } from "./KnowledgeCandidate";
import { SynthesisResult } from "./SynthesisResult";

/**
 * The engine responsible for grouping patterns and forming testable hypotheses.
 * This is an AI-driven boundary, meaning it will likely utilize an LLM.
 */
export interface IKnowledgeSynthesizer {
  
  /**
   * Phase 1: Group related patterns into conceptual clusters.
   * Prevents knowledge explosion.
   */
  clusterPatterns(patterns: readonly LearningPattern[]): Promise<readonly PatternCluster[]>;
  
  /**
   * Phase 2: Form a hypothesis from a cluster.
   */
  formulateHypothesis(cluster: PatternCluster): Promise<KnowledgeHypothesis>;
  
  /**
   * Phase 3: Package the hypothesis and cluster into a valid Candidate.
   * Returns a comprehensive SynthesisResult.
   */
  synthesizeCandidates(clusters: readonly PatternCluster[]): Promise<SynthesisResult>;
}
