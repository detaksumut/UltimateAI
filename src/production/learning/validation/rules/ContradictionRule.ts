// src/production/learning/validation/rules/ContradictionRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";

export class ContradictionRule implements ValidationRule {
  readonly category = RuleCategory.EVIDENCE;
  readonly name = "ContradictionRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    // In a real implementation, we would inspect the contradicting evidence from the source patterns.
    // We assume 0 contradicting for this mock implementation.
    const contradictingCount = 0; 
    const supportingCount = candidate.hypothesis.supportingEvidence.length;
    
    if (supportingCount === 0) {
        return {
            ruleName: this.name,
            ruleVersion: this.version,
            passed: false,
            severity: RuleSeverity.ERROR,
            reason: "Cannot evaluate contradiction ratio with 0 supporting evidence."
        };
    }

    const ratio = contradictingCount / supportingCount;

    if (ratio > context.policy.maximumContradictionRatio) {
      return {
        ruleName: this.name,
        ruleVersion: this.version,
        passed: false,
        severity: RuleSeverity.ERROR,
        reason: `Contradiction ratio ${ratio.toFixed(2)} exceeds maximum allowed ${context.policy.maximumContradictionRatio}.`
      };
    }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: `Contradiction ratio is within acceptable limits (${ratio.toFixed(2)}).`
    };
  }
}
