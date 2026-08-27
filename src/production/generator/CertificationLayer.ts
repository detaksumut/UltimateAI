import { ComposedArtifact } from "./ArtifactComposer";
import * as crypto from "crypto";

export type CertificationStatus = "CERTIFIED" | "REJECTED";

export interface GenerationCertificate {
  readonly certificateId: string;
  readonly status: CertificationStatus;
  readonly compositionHash: string;
  readonly issuedAt: string;
  readonly findings: string[];
  readonly summary: string;
}

/**
 * CertificationLayer inspects a ComposedArtifact, applies quality gates,
 * and issues a generation provenance certificate.
 */
export class CertificationLayer {
  certify(composition: ComposedArtifact): GenerationCertificate {
    const findings: string[] = [];

    // Gate 1: All artifacts must have non-empty content
    for (const artifact of composition.artifacts) {
      if (!artifact.content || artifact.content.trim().length === 0) {
        findings.push(`GATE FAILED: Artifact ${artifact.artifactId} has empty content`);
      }
    }

    // Gate 2: Composition hash must be present
    if (!composition.compositionHash || composition.compositionHash.length < 64) {
      findings.push("GATE FAILED: Composition hash missing or malformed");
    }

    // Gate 3: Total artifacts must match expected
    if (composition.totalArtifacts !== composition.artifacts.length) {
      findings.push(`GATE FAILED: Artifact count mismatch (declared ${composition.totalArtifacts} vs actual ${composition.artifacts.length})`);
    }

    // Gate 4: Repair log must be auditable (any repair is acceptable, but logged)
    if (composition.repairLog.length > 0) {
      findings.push(`INFO: ${composition.repairLog.length} auto-repair(s) applied — ${composition.repairLog.join("; ")}`);
    }

    const status: CertificationStatus = findings.some(f => f.startsWith("GATE FAILED")) ? "REJECTED" : "CERTIFIED";
    const certificateId = `UAI-USGEC-CERT-${crypto.createHash("sha256").update(composition.compositionHash).digest("hex").substring(0, 8).toUpperCase()}`;

    return {
      certificateId,
      status,
      compositionHash: composition.compositionHash,
      issuedAt: new Date().toISOString(),
      findings,
      summary: status === "CERTIFIED"
        ? `${composition.totalArtifacts} artifacts certified. ${composition.repairLog.length} repair(s) applied.`
        : `Certification REJECTED. ${findings.filter(f => f.startsWith("GATE FAILED")).length} gate(s) failed.`
    };
  }
}
