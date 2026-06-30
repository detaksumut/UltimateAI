// src/production/intelligence/reflection/ReflectionDecision.ts

import { TraceableArtifact } from "../contracts/TraceableArtifact";
import { CriticRecommendation } from "../critic/CriticRecommendation";

export enum ReflectionAction {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
  MODIFIED = "MODIFIED",
  DEFER = "DEFER" // When more info is needed or waiting on another engine
}

/**
 * An immutable decision made by the Reflection Engine regarding a specific
 * CriticRecommendation. This forms the audit trail for why a recommendation
 * was or wasn't applied.
 */
export interface ReflectionDecision extends TraceableArtifact {
  /** The ID of the CriticRecommendation being evaluated */
  readonly recommendationId: string;
  
  /** The decision action taken */
  readonly action: ReflectionAction;
  
  /** Human-readable explanation of why this decision was reached */
  readonly reason: string;
  
  /** Confidence score in this specific decision (0.0 to 1.0) */
  readonly confidence: number;
  
  /** 
   * If the action is MODIFIED, this contains the revised recommendation.
   * The original recommendation remains immutable in the audit trail.
   */
  readonly modifiedRecommendation?: CriticRecommendation;
}
