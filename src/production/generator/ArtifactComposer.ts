import { ArtifactResult } from "./GeneratorRegistry";
import * as crypto from "crypto";

export interface ComposedArtifact {
  readonly compositionId: string;
  readonly compositionHash: string;
  readonly artifacts: ArtifactResult[];
  readonly repairLog: string[];
  readonly totalArtifacts: number;
  readonly composedAt: string;
}

/**
 * ArtifactComposer aggregates all generated artifacts from the DAG,
 * performs structural validation and auto-repair where possible,
 * and produces a final ComposedArtifact ready for certification.
 */
export class ArtifactComposer {
  compose(artifacts: ArtifactResult[]): ComposedArtifact {
    const repairLog: string[] = [];
    const repairedArtifacts: ArtifactResult[] = [];

    for (const artifact of artifacts) {
      const { repaired, log } = this.validate(artifact);
      repairedArtifacts.push(repaired);
      repairLog.push(...log);
    }

    const compositionId = `composition-${Date.now()}`;
    const hashData = repairedArtifacts.map(a => a.artifactId + a.content).join("|");
    const compositionHash = crypto.createHash("sha256").update(hashData).digest("hex");

    return {
      compositionId,
      compositionHash,
      artifacts: repairedArtifacts,
      repairLog,
      totalArtifacts: repairedArtifacts.length,
      composedAt: new Date().toISOString()
    };
  }

  private validate(artifact: ArtifactResult): { repaired: ArtifactResult; log: string[] } {
    const log: string[] = [];
    let content = artifact.content;

    // Auto-repair: ensure content is non-empty
    if (!content || content.trim().length === 0) {
      content = `// Auto-repaired: empty content for ${artifact.generatorId}`;
      log.push(`[REPAIR] ${artifact.artifactId}: content was empty, inserted placeholder`);
    }

    // Auto-repair: ensure SQL artifacts have correct terminator
    if (artifact.outputType.startsWith("sql/") && !content.trimEnd().endsWith(";")) {
      content += "\n;";
      log.push(`[REPAIR] ${artifact.artifactId}: SQL artifact missing terminator, appended semicolon`);
    }

    return { repaired: { ...artifact, content }, log };
  }
}
