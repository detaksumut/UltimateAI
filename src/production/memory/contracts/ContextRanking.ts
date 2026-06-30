export interface ContextRanking {
  /** Ranking score from 0.0 to 1.0 */
  score: number;
  
  /** Human-readable explanation of why this context was selected */
  reason: string;
  
  /** The confidence of the retrieval strategy (Deterministic = 1.0) */
  confidence: number;
}
