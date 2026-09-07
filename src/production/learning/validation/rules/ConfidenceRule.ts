// src/production/learning/validation/rules/ConfidenceRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";

export class ConfidenceRule implements ValidationRule {
  readonly category = RuleCategory.STRUCTURAL;
  readonly name = "ConfidenceRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    const minScore = context.policy.minimumConfidenceScore;
    
    const strengthScoreMap: Record<string, number> = {
      "VERY_STRONG": 1.0,
      "STRONG": 0.85,
      "MODERATE": 0.65,
      "WEAK": 0.40
    };
    const baseScore = strengthScoreMap[candidate.hypothesis.strength] ?? 0.50;
    const evidenceBonus = Math.min((candidate.hypothesis.supportingEvidence?.length || 0) * 0.05, 0.15);
    const synthesizedScore = Math.min(baseScore + evidenceBonus, 1.0);

    if (synthesizedScore < minScore) {
      return {
        ruleName: this.name,
        ruleVersion: this.version,
        passed: false,
        severity: RuleSeverity.ERROR,
        reason: `Confidence score ${synthesizedScore} is below the required threshold of ${minScore}`
      };
    }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: "Confidence score meets policy requirements."
    };
  }
}
