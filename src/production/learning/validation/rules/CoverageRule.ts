// src/production/learning/validation/rules/CoverageRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";

export class CoverageRule implements ValidationRule {
  readonly category = RuleCategory.STRUCTURAL;
  readonly name = "CoverageRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    const coverage = candidate.experienceIds.length;
    const minCoverage = context.policy.minimumCoverageCount;

    if (coverage < minCoverage) {
      return {
        ruleName: this.name,
        ruleVersion: this.version,
        passed: false,
        severity: RuleSeverity.WARNING,
        reason: `Hypothesis is based on only ${coverage} experiences. Minimum recommended is ${minCoverage}.`
      };
    }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: `Coverage is sufficient (${coverage} experiences).`
    };
  }
}
