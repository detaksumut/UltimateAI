// src/production/learning/promotion/strategies/VersionStrategy.ts

/**
 * Dictates how version bumps occur during promotion.
 */
export enum VersionStrategy {
  /** Increment the version number based on semantic weight */
  INCREMENT = "INCREMENT",
  
  /** Replace the old version seamlessly without bumping (useful for hotfixes) */
  REPLACE = "REPLACE",
  
  /** Reset version to 1.0.0 (e.g., if scope changes drastically) */
  RESET = "RESET"
}
