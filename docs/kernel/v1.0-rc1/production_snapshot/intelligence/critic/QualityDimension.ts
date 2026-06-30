// src/production/intelligence/critic/QualityDimension.ts

/**
 * Defines the various dimensions along which the Critic Engine assesses quality.
 * This enum allows the evaluation model to be easily extended in the future.
 */
export enum QualityDimension {
  COMPLEXITY = "COMPLEXITY",
  COHESION = "COHESION",
  COUPLING = "COUPLING",
  PARALLELISM = "PARALLELISM",
  CAPABILITY_FIT = "CAPABILITY_FIT",
  MAINTAINABILITY = "MAINTAINABILITY"
}
