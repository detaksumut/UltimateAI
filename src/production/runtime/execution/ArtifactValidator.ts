import { IArtifactBundle } from "../../foundation/execution/IArtifactBundle";
import { IExecutionPlan } from "../../foundation/execution/IExecutionPlan";
import * as crypto from "crypto";

export interface BundleValidationReport {
  readonly isValid: boolean;
  readonly issues: string[];
  readonly metrics: {
    readonly completeness: number; // 0 to 100
    readonly integrityMatches: boolean;
  };
}

export class ArtifactValidator {
  /**
   * Menghitung hash biner akhir dari representasi data bundle secara deterministik
   */
  static calculateBundleHash(bundle: Omit<IArtifactBundle, "bundleHash">): string {
    // Sort artifacts by filepath to guarantee sorting determinism
    const sortedArtifacts = [...bundle.artifacts].sort((a, b) => a.filepath.localeCompare(b.filepath));
    const rawData = 
      JSON.stringify(bundle.bundleId) + 
      JSON.stringify(bundle.blueprintId) + 
      JSON.stringify(bundle.executionId) + 
      JSON.stringify(sortedArtifacts);
    return crypto.createHash("sha256").update(rawData).digest("hex");
  }

  validate(bundle: IArtifactBundle, plan: IExecutionPlan): BundleValidationReport {
    const issues: string[] = [];
    let integrityMatches = true;

    // 1. Completeness Check
    let presentCount = 0;
    plan.descriptors.forEach(desc => {
      const found = bundle.artifacts.find(a => a.filepath === desc.targetPath);
      if (found) {
        presentCount++;
        
        // Basic syntax verification: ensure content is not empty
        if (!found.content.trim()) {
          issues.push(`Artifact integrity error: File ${found.filepath} is empty`);
        }
      } else {
        issues.push(`Artifact completeness error: Missing expected file ${desc.targetPath}`);
      }
    });

    const completeness = Math.round((presentCount / plan.descriptors.length) * 100);

    // 2. Hash Integrity check
    const expectedHash = ArtifactValidator.calculateBundleHash(bundle);
    if (expectedHash !== bundle.bundleHash) {
      issues.push("Artifact bundle integrity failure: Hash signature mismatch");
      integrityMatches = false;
    }

    const isValid = issues.length === 0 && integrityMatches;

    return {
      isValid,
      issues,
      metrics: {
        completeness,
        integrityMatches
      }
    };
  }
}
