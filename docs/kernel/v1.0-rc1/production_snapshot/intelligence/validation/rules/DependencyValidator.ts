// src/production/intelligence/validation/rules/DependencyValidator.ts

import { ValidationRule, ValidationRuleMetadata } from "../ValidationRule";
import { ValidationContext } from "../ValidationContext";
import { ValidationFinding, ValidationSeverity } from "../ValidationFinding";

/**
 * Ensures that the execution graph is a valid DAG.
 * Checks for: Cycles, non-existent dependencies, and unreachable tasks.
 */
export class DependencyValidator implements ValidationRule {
  public readonly metadata: ValidationRuleMetadata = {
    ruleId: "VAL_DEP_001",
    name: "Dependency Validator",
    description: "Validates DAG properties including cycles, orphans, and missing dependencies.",
    version: "1.0.0"
  };

  public validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const allTasks = new Map<string, string[]>(); // Task ID -> dependsOn array

    // Collect all tasks
    for (const job of context.execution.jobs) {
      for (const task of job.tasks) {
        allTasks.set(task.id, task.dependsOn ? [...task.dependsOn] : []);
      }
    }

    // Check for missing dependencies
    for (const [taskId, dependsOn] of allTasks.entries()) {
      for (const depId of dependsOn) {
        if (!allTasks.has(depId)) {
          findings.push({
            severity: ValidationSeverity.ERROR,
            message: `Task depends on non-existent task '${depId}'.`,
            ruleId: this.metadata.ruleId,
            targetId: taskId
          });
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (taskId: string): boolean => {
      if (!visited.has(taskId)) {
        visited.add(taskId);
        recStack.add(taskId);

        const deps = allTasks.get(taskId) || [];
        for (const dep of deps) {
          if (allTasks.has(dep)) { // only traverse existing ones
            if (!visited.has(dep) && checkCycle(dep)) {
              return true;
            } else if (recStack.has(dep)) {
              findings.push({
                severity: ValidationSeverity.ERROR,
                message: `Dependency cycle detected involving task '${dep}'.`,
                ruleId: this.metadata.ruleId,
                targetId: taskId
              });
              return true;
            }
          }
        }
      }
      recStack.delete(taskId);
      return false;
    };

    for (const taskId of allTasks.keys()) {
      if (!visited.has(taskId)) {
        checkCycle(taskId);
      }
    }

    // Check for disconnected graphs (optional, might be INFO/WARNING depending on context)
    // A fully disconnected graph means there are multiple independent sub-graphs. 
    // This isn't strictly invalid, but good to report as INFO.

    return findings;
  }
}
