import { NormalizedRequirements } from "../RequirementNormalizer";

export class OjsValidator {
  validate(normalized: NormalizedRequirements): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!normalized.metadata.issn || normalized.metadata.issn === "0000-0000") {
      issues.push("Invalid ISSN code: ISSN must not be default dummy placeholder");
    }
    if (normalized.metadata.indexingTarget.length === 0) {
      issues.push("Target indexing is missing: Target must declare at least SCOPUS or SINTA");
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
