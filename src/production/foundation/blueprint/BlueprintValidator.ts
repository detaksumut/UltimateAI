import { IDomainBlueprint } from "./IDomainBlueprint";
import * as crypto from "crypto";

export interface ValidationIssue {
  readonly level: "CRITICAL" | "WARNING";
  readonly message: string;
}

export interface ValidationReport {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly metrics: {
    readonly completeness: number; // 0 to 100
    readonly hasSemanticErrors: boolean;
    readonly hashMatches: boolean;
  };
}

export class BlueprintValidator {
  /**
   * Menghitung hash SHA-256 dari spesifikasi arsitektur sesuai aturan UAI-FB-1.0
   */
  static calculateHash(blueprint: Omit<IDomainBlueprint, "blueprintHash">): string {
    const rawData = 
      JSON.stringify(blueprint.schemaVersion) + 
      JSON.stringify(blueprint.specification) + 
      JSON.stringify(blueprint.metadata);
    return crypto.createHash("sha256").update(rawData).digest("hex");
  }

  validate(blueprint: IDomainBlueprint): ValidationReport {
    const issues: ValidationIssue[] = [];
    let hasSemanticErrors = false;

    // 1. Structural Schema Validation
    if (!blueprint.blueprintId || !blueprint.domain || !blueprint.analysisId || !blueprint.status) {
      issues.push({ level: "CRITICAL", message: "Schema error: Missing core blueprint fields" });
      hasSemanticErrors = true;
    }

    // 2. Foundation Compatibility Validation
    if (blueprint.foundationBaseline !== "UAI-FB-1.0") {
      issues.push({ level: "CRITICAL", message: `Incompatible baseline: Expected UAI-FB-1.0, got ${blueprint.foundationBaseline}` });
      hasSemanticErrors = true;
    }

    if (blueprint.schemaVersion !== "1.0") {
      issues.push({ level: "CRITICAL", message: `Incompatible schema version: Expected 1.0, got ${blueprint.schemaVersion}` });
      hasSemanticErrors = true;
    }

    // 3. Contract / Hash Integrity Validation
    const expectedHash = BlueprintValidator.calculateHash(blueprint);
    const hashMatches = expectedHash === blueprint.blueprintHash;
    if (!hashMatches) {
      issues.push({ level: "CRITICAL", message: "Contract integrity failure: Blueprint hash mismatch" });
      hasSemanticErrors = true;
    }

    // 4. Semantic Completeness Check
    const spec = blueprint.specification;
    let completeCount = 0;
    const requiredSections = ["database", "workflow", "compliance", "security", "api"];
    
    requiredSections.forEach(section => {
      if (spec[section]) {
        completeCount++;
      } else {
        issues.push({ level: "WARNING", message: `Blueprint Completeness warning: Missing '${section}' section` });
      }
    });

    const completeness = Math.round((completeCount / requiredSections.length) * 100);

    // 5. Semantic Validation (Business Rules)
    // Aturan: Jika target indexing Scopus, maka review model tidak boleh 'single-blind' atau 'unknown'
    if (spec.compliance && spec.compliance.indexingTarget && spec.compliance.indexingTarget.includes("SCOPUS")) {
      if (spec.workflow && (spec.workflow.reviewMethod === "single-blind" || spec.workflow.reviewMethod === "unknown")) {
        issues.push({ 
          level: "CRITICAL", 
          message: "Semantic error: Scopus target indexing requires double-blind peer review, single-blind is invalid" 
        });
        hasSemanticErrors = true;
      }
    }

    const isValid = !hasSemanticErrors && hashMatches;

    return {
      isValid,
      issues,
      metrics: {
        completeness,
        hasSemanticErrors,
        hashMatches
      }
    };
  }
}
