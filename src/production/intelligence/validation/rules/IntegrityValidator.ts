// src/production/intelligence/validation/rules/IntegrityValidator.ts

import { ValidationRule, ValidationRuleMetadata } from "../ValidationRule";
import { ValidationContext } from "../ValidationContext";
import { ValidationFinding, ValidationSeverity } from "../ValidationFinding";

/**
 * Ensures the structural integrity of the Execution plan.
 * Checks ID uniqueness, correct parent references, and non-empty structures.
 */
export class IntegrityValidator implements ValidationRule {
  public readonly metadata: ValidationRuleMetadata = {
    ruleId: "VAL_INT_001",
    name: "Integrity Validator",
    description: "Validates consistent IDs, job-task hierarchies, and uniqueness.",
    version: "1.0.0"
  };

  public validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const execId = context.execution.id;
    
    const seenJobIds = new Set<string>();
    const seenTaskIds = new Set<string>();

    if (context.execution.jobs.length === 0) {
      findings.push({
        severity: ValidationSeverity.WARNING,
        message: "Execution plan contains no jobs.",
        ruleId: this.metadata.ruleId,
        targetId: execId
      });
    }

    for (const job of context.execution.jobs) {
      if (seenJobIds.has(job.id)) {
        findings.push({
          severity: ValidationSeverity.ERROR,
          message: `Duplicate Job ID found: ${job.id}`,
          ruleId: this.metadata.ruleId,
          targetId: job.id
        });
      }
      seenJobIds.add(job.id);

      if (job.executionId !== execId) {
        findings.push({
          severity: ValidationSeverity.ERROR,
          message: `Job's executionId (${job.executionId}) does not match Execution ID (${execId}).`,
          ruleId: this.metadata.ruleId,
          targetId: job.id
        });
      }

      if (job.tasks.length === 0) {
        findings.push({
          severity: ValidationSeverity.ERROR,
          message: "Job contains no tasks.",
          ruleId: this.metadata.ruleId,
          targetId: job.id
        });
      }

      for (const task of job.tasks) {
        if (seenTaskIds.has(task.id)) {
          findings.push({
            severity: ValidationSeverity.ERROR,
            message: `Duplicate Task ID found: ${task.id}`,
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
        }
        seenTaskIds.add(task.id);

        if (task.jobId !== job.id) {
          findings.push({
            severity: ValidationSeverity.ERROR,
            message: `Task's jobId (${task.jobId}) does not match parent Job ID (${job.id}).`,
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
        }

        if (task.executionId !== execId) {
          findings.push({
            severity: ValidationSeverity.ERROR,
            message: `Task's executionId (${task.executionId}) does not match Execution ID (${execId}).`,
            ruleId: this.metadata.ruleId,
            targetId: task.id
          });
        }
      }
    }

    return findings;
  }
}
