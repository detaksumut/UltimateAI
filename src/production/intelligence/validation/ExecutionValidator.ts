// src/production/intelligence/validation/ExecutionValidator.ts

import { ValidationContext } from "./ValidationContext";
import { ValidationReport } from "./ValidationReport";
import { ValidationRule } from "./ValidationRule";
import { CycleDetectionRule } from "./rules/CycleDetectionRule";
import { DependencyResolutionRule } from "./rules/DependencyResolutionRule";
import { CapabilityMatchRule } from "./rules/CapabilityMatchRule";
import { KnowledgeProjectionType } from "../../knowledge/projection/KnowledgeProjectionType";

/**
 * Context provided to Validation Rules.
 */
export interface ValidationContext {
  readonly execution: Execution;
  readonly context: unknown; // e.g., the Kernel context
  readonly availableWorkers: readonly unknown[];
}

/**
 * Core orchestrator for Execution validation.
 * It applies the Open/Closed ValidationRule pattern.
 */
export class ExecutionValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    // Register default rules
    this.registerRule(new CycleDetectionRule());
    this.registerRule(new DependencyResolutionRule());
    this.registerRule(new CapabilityMatchRule());
  }

  public registerRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  public async validate(context: ValidationContext): Promise<ValidationReport> {
    const startTime = Date.now();
    const allFindings: ValidationFinding[] = [];

    for (const rule of this.rules) {
      const findings = await rule.evaluate(context);
      allFindings.push(...findings);
    }

    const hasErrors = allFindings.some(f => f.severity === "ERROR");

    return {
      id: `val-${Date.now()}`,
      correlationId: context.execution.correlationId,
      source: "ExecutionValidator",
      createdAt: new Date(),
      projectionType: KnowledgeProjectionType.VALIDATION_REPORT,
      isValid: !hasErrors,
      findings: allFindings,
      statistics: {
        totalJobs: context.execution.jobs.length,
        totalTasks: context.execution.jobs.reduce((sum, j) => sum + j.tasks.length, 0),
        ruleExecutionCount: this.rules.length
      },
      durationMs: Date.now() - startTime
    };
  }
}
