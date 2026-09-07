// src/production/learning/experience/ExperienceExtractorImpl.ts

import { IExperienceExtractor } from "./IExperienceExtractor";
import { ReconstructionResult } from "../../knowledge/reconstruction/ReconstructionResult";
import { ExtractionResult } from "./ExtractionResult";
import { Experience } from "./Experience";
import { ExperienceOutcome } from "./ExperienceOutcome";

/**
 * Deterministically extracts raw Experiences from a Knowledge ReconstructionResult.
 * Strictly free from heuristics or artificial hallucinations.
 */
export class ExperienceExtractorImpl implements IExperienceExtractor {
  async extract(reconstruction: ReconstructionResult): Promise<ExtractionResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const experiences: Experience[] = [];

    try {
      // Determine outcome from metrics or warnings
      let outcome = ExperienceOutcome.SUCCESS;
      if (reconstruction.warnings && reconstruction.warnings.length > 0) {
        outcome = ExperienceOutcome.PARTIAL_SUCCESS;
        for (const w of reconstruction.warnings) {
          warnings.push(typeof w === 'string' ? w : (w as any).message || String(w));
        }
      }

      // Collect all raw deterministic facts
      const rawFacts: string[] = [];
      if (reconstruction.extractedFacts && Array.isArray(reconstruction.extractedFacts)) {
        rawFacts.push(...reconstruction.extractedFacts);
      }

      if (reconstruction.sourceLogId) {
        rawFacts.push(`sourceLogId: ${reconstruction.sourceLogId}`);
      }

      if (reconstruction.path && reconstruction.path.steps) {
        for (const step of reconstruction.path.steps) {
          rawFacts.push(`step: ${step.nodeId || 'unknown'} via ${step.edgeId || 'direct'}`);
        }
      }

      const experience: Experience = {
        id: `exp-${reconstruction.reconstructionId || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        schemaVersion: "1.0.0",
        createdAt: new Date(reconstruction.reconstructedAt || Date.now()),
        sourceId: reconstruction.reconstructionId || "unknown-reconstruction",
        context: {
          correlationId: reconstruction.trace?.requestId || `corr-${Date.now()}`,
          conversationId: reconstruction.trace?.traceId,
          executionId: reconstruction.sourceLogId
        },
        metadata: {
          engineVersion: "1.0.0",
          attributes: {
            metrics: reconstruction.metrics || {}
          }
        },
        outcome,
        facts: Object.freeze(rawFacts)
      };

      experiences.push(experience);
    } catch (err: any) {
      warnings.push(`Extraction error: ${err.message}`);
    }

    return {
      experiences: Object.freeze(experiences),
      warnings: Object.freeze(warnings),
      durationMs: Date.now() - startedAt
    };
  }
}
