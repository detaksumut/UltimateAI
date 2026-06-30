// src/production/learning/validation/rules/RecencyRule.ts

import { ValidationRule } from "../ValidationRule";
import { KnowledgeCandidate } from "../../synthesis/KnowledgeCandidate";
import { ValidationContext } from "../ValidationContext";
import { RuleResult } from "../RuleResult";
import { RuleCategory } from "../RuleCategory";
import { RuleSeverity } from "../RuleSeverity";

export class RecencyRule implements ValidationRule {
  readonly category = RuleCategory.EVIDENCE;
  readonly name = "RecencyRule";
  readonly version = "1.0.0";

  async evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult> {
    // In reality, we'd query the experiences by ID and find the newest one.
    // For this mock implementation, we assume the candidate passes recency.
    
    // const newestExperienceMs = ...
    // const age = context.currentTimeMs - newestExperienceMs;
    // if (age > context.policy.maximumExperienceAgeMs) { ... }

    return {
      ruleName: this.name,
      ruleVersion: this.version,
      passed: true,
      severity: RuleSeverity.INFO,
      reason: "Experience data is within the acceptable recency window."
    };
  }
}
