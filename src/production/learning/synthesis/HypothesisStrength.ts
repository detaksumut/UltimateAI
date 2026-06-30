// src/production/learning/synthesis/HypothesisStrength.ts

/**
 * Value object representing the qualitative strength of a synthesized hypothesis.
 * Differentiates from raw statistical confidence by representing the conceptual validity.
 */
export enum HypothesisStrength {
  WEAK = "WEAK",
  MODERATE = "MODERATE",
  STRONG = "STRONG",
  VERY_STRONG = "VERY_STRONG"
}
