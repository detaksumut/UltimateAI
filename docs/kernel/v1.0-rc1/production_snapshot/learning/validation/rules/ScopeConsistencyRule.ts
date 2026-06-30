// src/production/learning/validation/rules/ScopeConsistencyRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";
import { KnowledgeScope } from "../../synthesis/KnowledgeScope";

export class ScopeConsistencyRule implements ValidationRule {
  readonly category = RuleCategory.SEMANTIC;
  readonly name = "ScopeConsistencyRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    // Validates that the AI didn't claim GLOBAL scope if the evidence only
    // comes from a single TASK or WORKFLOW.
    
    // Mock logic
    if (candidate.hypothesis.recommendedScope === KnowledgeScope.GLOBAL && candidate.experienceIds.length < 5) {
      return {
        ruleName: this.name,
        ruleVersion: this.version,
        passed: false,
        severity: RuleSeverity.WARNING,
        reason: "Scope is GLOBAL but is backed by very few experiences. Suggest downgrading scope."
      };
    }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: "Requested scope aligns with evidence breadth."
    };
  }
}
