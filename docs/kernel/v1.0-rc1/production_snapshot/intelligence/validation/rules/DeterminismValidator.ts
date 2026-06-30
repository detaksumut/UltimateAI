// src/production/intelligence/validation/rules/DeterminismValidator.ts

import { ValidationRule, ValidationRuleMetadata } from "../ValidationRule";
import { ValidationContext } from "../ValidationContext";
import { ValidationFinding, ValidationSeverity } from "../ValidationFinding";

/**
 * Ensures the Execution DAG conforms to deterministic contracts.
 * For instance, checking that no task contains undefined/random payload shapes
 * that violate the schema, or ensuring strict ordering.
 */
export class DeterminismValidator implements ValidationRule {
  public readonly metadata: ValidationRuleMetadata = {
    ruleId: "VAL_DET_001",
    name: "Determinism Validator",
    description: "Validates that the Execution plan adheres to deterministic, reproducible constraints.",
    version: "1.0.0"
  };

  public validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    // Future enhancement: Deep scan of task payloads to ensure 
    // no forbidden non-deterministic parameters are set (e.g., temperature = 1 in sub-tasks)
    
    // For now, we do a basic pass ensuring payload exists and is a valid object
    for (const job of context.execution.jobs) {
      for (const task of job.tasks) {
        if (task.payload && typeof task.payload !== 'object') {
          findings.push({
            severity: ValidationSeverity.WARNING,
            message: `Task payload should be a structured object for determinism, found ${typeof task.payload}.`,
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
        }
      }
    }

    return findings;
  }
}
