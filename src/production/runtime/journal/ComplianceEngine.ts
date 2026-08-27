import { NormalizedRequirements } from "./RequirementNormalizer";

export interface KnowledgeRule {
  readonly id: string;
  readonly code: string;
  readonly value: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
}

/**
 * KnowledgeProvider - Provider Interface for Decoupling
 * Memisahkan Compliance Engine dari Knowledge Runtime secara arsitektural.
 */
export interface KnowledgeProvider {
  fetchRules(packName: string): Promise<KnowledgeRule[]>;
}

export interface ComplianceResult {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly passed: boolean;
  readonly message: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
}

export class ComplianceEngine {
  private readonly provider: KnowledgeProvider;

  constructor(provider: KnowledgeProvider) {
    this.provider = provider;
  }

  async checkCompliance(req: NormalizedRequirements): Promise<{ passed: boolean; results: ComplianceResult[]; errors: string[] }> {
    const results: ComplianceResult[] = [];
    const errors: string[] = [];

    try {
      // Mengambil aturan dari Knowledge Provider Interface secara dinamis
      const rules = await this.provider.fetchRules("ojs-compliance-pack");
      
      for (const rule of rules) {
        if (rule.code === "ISSN_FORMAT") {
          const isFormatValid = /^[0-9]{4}-[0-9]{3}[0-9X]$/.test(req.issn);
          results.push({
            ruleId: rule.id,
            ruleName: "ISSN Format Validation",
            passed: isFormatValid,
            message: isFormatValid ? "ISSN format is valid" : "ISSN format is invalid, must match xxxx-xxxx pattern",
            severity: rule.severity
          });
        }
        
        if (rule.code === "REVIEW_METHOD") {
          const isReviewValid = req.reviewModel === "double-blind" || req.reviewModel === "single-blind" || req.reviewModel === "open";
          results.push({
            ruleId: rule.id,
            ruleName: "Peer Review Standard Validation",
            passed: isReviewValid,
            message: isReviewValid ? "Peer review method complies with standards" : "Peer review method must be double-blind, single-blind, or open",
            severity: rule.severity
          });
        }
      }
      
    } catch (err: any) {
      // Graceful Failure Test: Jika Knowledge Provider bermasalah/offline,
      // kita tangani secara anggun tanpa crash dan berikan warnings.
      errors.push(`Knowledge Provider offline: ${err.message}`);
      results.push({
        ruleId: "ERR_OFFLINE",
        ruleName: "Knowledge Integration Status",
        passed: false,
        message: "Aturan kepatuhan tidak dapat dimuat karena sistem offline. Menggunakan evaluasi dasar.",
        severity: "WARNING"
      });
    }

    const passed = results.every(r => r.passed || r.severity !== "CRITICAL") && errors.length === 0;

    return { passed, results, errors };
  }
}
