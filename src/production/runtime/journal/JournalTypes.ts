import { NormalizedRequirements } from "./RequirementNormalizer";
import { Recommendation, ConfidenceDerivation } from "./JournalIntelligence";
import { ComplianceResult } from "./ComplianceEngine";

/**
 * JournalTypes.ts
 * Shared journal domain types, extracted from JournalRuntime to break the
 * JournalRuntime ↔ BlueprintGenerator circular dependency (dependency-cruiser
 * no-circular). Both JournalRuntime and BlueprintGenerator import these from
 * this leaf module.
 */

export interface DomainAnalysisResult {
  readonly normalizedRequirements: NormalizedRequirements;
  readonly observations: string[];
  readonly recommendations: Recommendation[];
  readonly complianceResults: ComplianceResult[];
  readonly confidence: ConfidenceDerivation;
  readonly explainability: string[];
  readonly warnings: string[];
  readonly nextAction: string;
}
