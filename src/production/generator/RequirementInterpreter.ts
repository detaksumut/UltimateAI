import * as crypto from "crypto";

export interface RequirementModel {
  readonly requirementId: string;
  readonly domain: string;
  readonly description: string;
  readonly features: string[];
  readonly scale: "small" | "medium" | "enterprise";
  readonly timestamp: number;
  readonly hash: string;
}

export class RequirementInterpreter {
  interpret(naturalLanguage: string): RequirementModel {
    if (!naturalLanguage || naturalLanguage.trim() === "") {
      throw new Error("Interpreter Error: Natural language requirement string must not be empty");
    }

    const text = naturalLanguage.toLowerCase();
    
    // Domain detection
    let domain = "journal"; // default fallback
    if (text.includes("medical") || text.includes("clinic") || text.includes("hipaa")) {
      domain = "medical";
    } else if (text.includes("legal") || text.includes("court") || text.includes("sidang")) {
      domain = "legal";
    } else if (text.includes("journal") || text.includes("ojs") || text.includes("penerbitan")) {
      domain = "journal";
    }

    // Scale detection
    let scale: "small" | "medium" | "enterprise" = "small";
    if (text.includes("nasional") || text.includes("enterprise") || text.includes("global") || text.includes("skala besar")) {
      scale = "enterprise";
    } else if (text.includes("medium") || text.includes("regional") || text.includes("standard")) {
      scale = "medium";
    }

    // Features extraction
    const features: string[] = [];
    if (text.includes("reviewer") || text.includes("penilai")) {
      features.push("reviewer-management");
    }
    if (text.includes("doi")) {
      features.push("doi-registration");
    }
    if (text.includes("orcid")) {
      features.push("orcid-integration");
    }
    if (text.includes("crossref")) {
      features.push("crossref-indexing");
    }
    if (text.includes("docker")) {
      features.push("docker-deployment");
    }
    if (text.includes("dashboard")) {
      features.push("dashboard-views");
    }

    const requirementId = `req-e1-${crypto.createHash("sha256").update(naturalLanguage).digest("hex").substring(0, 8)}`;
    const timestamp = Date.now();

    // Calculating Requirement Hash for Provenance
    const hashData = `${requirementId}:${domain}:${scale}:${features.join(",")}:${timestamp}`;
    const hash = crypto.createHash("sha256").update(hashData).digest("hex");

    return {
      requirementId,
      domain,
      description: naturalLanguage,
      features,
      scale,
      timestamp,
      hash
    };
  }
}
