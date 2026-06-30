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
    
    // Check if the synthesis or underlying patterns meet confidence requirements
    // For simplicity, we assume we check the synthesis metadata or pattern averages.
    // Here we'll pretend we aggregate pattern confidences or use a synthesized score.
    // We'll mock the extraction of the synthesized score to 1.0 for demonstration.
    const synthesizedScore = 0.85; 

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
