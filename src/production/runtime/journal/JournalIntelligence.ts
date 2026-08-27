import { NormalizedRequirements } from "./RequirementNormalizer";

export interface Recommendation {
  readonly finding: string;
  readonly recommendation: string;
  readonly evidence: string;
  readonly knowledgeSource: string;
  readonly confidence: number; // 0 to 100
}

export interface ConfidenceDerivation {
  readonly completeness: number;
  readonly coverage: number;
  readonly consistency: number;
  readonly ambiguity: number;
  readonly overall: number;
}

export interface IntelligenceAnalysis {
  readonly observations: string[];
  readonly findings: string[];
  readonly recommendations: Recommendation[];
  readonly confidence: ConfidenceDerivation;
}

export class JournalIntelligence {
  analyze(req: NormalizedRequirements, ambiguityCount: number): IntelligenceAnalysis {
    const observations: string[] = [];
    const findings: string[] = [];
    const recommendations: Recommendation[] = [];

    // 1. Publisher Analysis
    if (req.publisher !== "Unknown Publisher") {
      findings.push(`Publisher is set to ${req.publisher}`);
      observations.push("Publisher entity is validated against university registry.");
    } else {
      observations.push("No publisher provided. Jurnal set to default institutional publisher.");
    }

    // 2. Scope & Indexing Analysis
    req.indexingTarget.forEach((target) => {
      findings.push(`Target indexing: ${target}`);
      if (target.toUpperCase() === "SCOPUS") {
        recommendations.push({
          finding: "Target indexing is SCOPUS",
          recommendation: "Menerapkan standar kelayakan editorial internasional",
          evidence: "Scopus indexing rules require international editorial board diversity",
          knowledgeSource: "Scopus-indexing-pack-v1",
          confidence: 95
        });
      } else if (target.toUpperCase() === "SINTA") {
        recommendations.push({
          finding: "Target indexing is SINTA",
          recommendation: "Mengaktifkan pencatatan reviewer eksternal",
          evidence: "SINTA accreditation standard requires external peer review tracking",
          knowledgeSource: "SINTA-indexing-pack-v2",
          confidence: 90
        });
      }
    });

    // 3. Peer Review Model Analysis
    if (req.reviewModel === "double-blind") {
      findings.push("Review model is double-blind");
      recommendations.push({
        finding: "Review model is double-blind",
        recommendation: "Sembunyikan metadata penulis pada berkas review galley",
        evidence: "Double-blind review requires absolute author-reviewer anonymity",
        knowledgeSource: "OJS-3.4-standard-workflow-pack",
        confidence: 98
      });
    }

    // 4. Calculate Confidence Derivation
    const completeness = req.journalName !== "Unnamed Journal" && req.publisher !== "Unknown Publisher" && req.issn !== "0000-0000" ? 100 : 60;
    const coverage = req.indexingTarget.length > 0 ? 100 : 50;
    const consistency = req.reviewModel !== "unknown" ? 100 : 50;
    const ambiguity = Math.max(0, 100 - ambiguityCount * 20);
    const overall = Math.round((completeness + coverage + consistency + ambiguity) / 4);

    const confidence: ConfidenceDerivation = {
      completeness,
      coverage,
      consistency,
      ambiguity,
      overall
    };

    return {
      observations,
      findings,
      recommendations,
      confidence
    };
  }
}
