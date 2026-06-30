import { QualityDimension } from "./QualityDimension";
import { CriticRecommendation } from "./CriticRecommendation";
import { TraceableArtifact } from "../contracts/TraceableArtifact";

/**
 * The multidimensional assessment of an Execution plan's quality.
 * It scores specific structural traits and provides structured recommendations,
 * rather than a generic pass/fail boolean.
 */
export interface CriticEvaluation extends TraceableArtifact {
  /** The overall normalized score (0.0 to 1.0) */
  readonly overallScore: number;
  
  /** Detailed score and observation for each quality dimension */
  readonly dimensions: ReadonlyMap<QualityDimension, {
    readonly score: number;
    readonly observation: string;
  }>;
  
  /** 
   * Specific categorical assessments.
   * e.g., Complexity could be 'TOO_GRANULAR', 'TOO_MONOLITHIC', or 'BALANCED'
   */
  readonly complexityAssessment: 'TOO_GRANULAR' | 'TOO_MONOLITHIC' | 'BALANCED';
  
  /** Machine-readable instructions for the Repair Engine */
  readonly recommendations: readonly CriticRecommendation[];
}
