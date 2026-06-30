// src/production/learning/validation/rules/EvidenceRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";

export class EvidenceRule implements ValidationRule {
  readonly category = RuleCategory.EVIDENCE;
  readonly name = "EvidenceRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    if (candidate.hypothesis.supportingEvidence.length === 0) {
      return {
        ruleName: this.name,
        ruleVersion: this.version,
        passed: false,
        severity: RuleSeverity.ERROR,
        reason: "Hypothesis lacks any supporting evidence."
      };
    }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: `Found ${candidate.hypothesis.supportingEvidence.length} pieces of supporting evidence.`
    };
  }
}
