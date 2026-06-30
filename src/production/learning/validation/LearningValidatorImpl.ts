// src/production/learning/validation/LearningValidatorImpl.ts

import { ILearningValidator } from "./ILearningValidator";
import { KnowledgeCandidate } from "../synthesis/KnowledgeCandidate";
import { ValidationContext } from "./ValidationContext";
import { ValidationReport } from "./ValidationReport";
import { ValidationRule } from "./ValidationRule";
import { RuleSeverity } from "./RuleSeverity";

export class LearningValidatorImpl implements ILearningValidator {
  
  constructor(private readonly rules: readonly ValidationRule[]) {}

  async validate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<ValidationReport> {
    const startedAt = Date.now();
    
    // Evaluate rules (can be optimized with Promise.all for parallelism since they are pure)
    const ruleResults = await Promise.all(
      this.rules.map(rule => rule.evaluate(candidate, context))
    );
    
    const finishedAt = Date.now();
    const durationMs = finishedAt - startedAt;

    // Check if any rule failed with an ERROR severity
    const hasFatalError = ruleResults.some(result => !result.passed && result.severity === RuleSeverity.ERROR);
    const passed = !hasFatalError;
    
    const summary = passed 
      ? `Candidate passed validation with ${ruleResults.filter(r => !r.passed).length} warnings.`
      : `Candidate rejected due to fatal policy violations.`;

    // Candidate is strictly treated as immutable, we only return the report.
    return {
      candidateId: candidate.id,
      startedAt,
      finishedAt,
      durationMs,
      ruleResults,
      passed,
      summary
    };
  }
}
