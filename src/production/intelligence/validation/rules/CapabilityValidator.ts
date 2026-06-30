// src/production/intelligence/validation/rules/CapabilityValidator.ts

import { ValidationRule, ValidationRuleMetadata } from "../ValidationRule";
import { ValidationContext } from "../ValidationContext";
import { ValidationFinding, ValidationSeverity } from "../ValidationFinding";

/**
 * Ensures that all tasks map to known capabilities.
 * It does NOT check provider availability, only that the task 'type' 
 * is a registered capability in the metadata.
 */
export class CapabilityValidator implements ValidationRule {
  public readonly metadata: ValidationRuleMetadata = {
    ruleId: "VAL_CAP_001",
    name: "Capability Validator",
    description: "Validates that every task requests a known capability.",
    version: "1.0.0"
  };

  public validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    
    // Aggregate known capabilities from context metadata
    const knownCapabilities = new Set<string>();
    if (context.availableWorkers) {
      for (const worker of context.availableWorkers) {
        for (const cap of worker.capabilities) {
          knownCapabilities.add(cap);
        }
      }
    }

    for (const job of context.execution.jobs) {
      for (const task of job.tasks) {
        if (!task.type || task.type.trim() === "") {
          findings.push({
            severity: ValidationSeverity.ERROR,
            message: "Task has no specified type (capability).",
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
          continue;
        }

        // If availableWorkers are provided in context, we check against them
        // Otherwise, we skip capability resolution validation.
        if (context.availableWorkers && !knownCapabilities.has(task.type)) {
          findings.push({
            severity: ValidationSeverity.WARNING,
            message: `Task requests an unknown capability: '${task.type}'. No registered worker supports it currently.`,
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
        }
      }
    }

    return findings;
  }
}
