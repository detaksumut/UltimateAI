// src/production/learning/promotion/PromotionPolicy.ts

import { HypothesisStrength } from "../synthesis/HypothesisStrength";
import { ConflictResolutionStrategy } from "./strategies/ConflictResolutionStrategy";
import { VersionStrategy } from "./strategies/VersionStrategy";

/**
 * Rules that dictate HOW a validated candidate becomes active knowledge.
 */
export interface PromotionPolicy {
  /** If true, older versions of this knowledge are marked SUPERSEDED */
  readonly archiveSuperseded: boolean;
  
  /** If true, human approval is required for GLOBAL scope knowledge */
  readonly requireHumanApprovalForGlobalScope: boolean;
  
  /** Minimum strength required to claim a GLOBAL scope */
  readonly minimumStrengthForGlobal: HypothesisStrength;
  
  /** Determines how conflicts with existing knowledge are handled */
  readonly conflictResolutionStrategy: ConflictResolutionStrategy;
  
  /** Default bumping strategy */
  readonly defaultVersionStrategy: VersionStrategy;
  
  /** The target subsystem/repository for this class of knowledge */
  readonly targetRepository: string;
}
