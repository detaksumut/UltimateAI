// src/production/learning/synthesis/KnowledgeSynthesizerImpl.ts

import { IKnowledgeSynthesizer } from "./IKnowledgeSynthesizer";
import { LearningPattern } from "../pattern/LearningPattern";
import { PatternCluster } from "./PatternCluster";
import { KnowledgeHypothesis } from "./KnowledgeHypothesis";
import { KnowledgeCandidate } from "./KnowledgeCandidate";
import { SynthesisResult } from "./SynthesisResult";
import { CandidateStatus } from "./CandidateStatus";
import { HypothesisStrength } from "./HypothesisStrength";
import { KnowledgeScope } from "./KnowledgeScope";

/**
 * Concrete KnowledgeSynthesizer for Milestone 8.
 * Groups patterns into thematic clusters, forms grounded hypotheses, and generates candidates.
 */
export class KnowledgeSynthesizerImpl implements IKnowledgeSynthesizer {
  async clusterPatterns(patterns: readonly LearningPattern[]): Promise<readonly PatternCluster[]> {
    if (!patterns || patterns.length === 0) return [];

    const clusters: PatternCluster[] = [];
    const grouped = new Map<string, LearningPattern[]>();

    for (const pat of patterns) {
      const theme = pat.type || "GENERAL";
      if (!grouped.has(theme)) grouped.set(theme, []);
      grouped.get(theme)!.push(pat);
    }

    for (const [theme, pats] of grouped.entries()) {
      clusters.push({
        id: `cluster-${theme.toLowerCase()}-${Date.now()}`,
        theme,
        patterns: Object.freeze(pats)
      });
    }

    return Object.freeze(clusters);
  }

  async formulateHypothesis(cluster: PatternCluster): Promise<KnowledgeHypothesis> {
    const patternCount = cluster.patterns.length;
    const allSupporting = cluster.patterns.flatMap(p => p.supportingEvidence.map(e => e.experienceId));
    const allContradicting = cluster.patterns.flatMap(p => p.contradictingEvidence.map(e => e.experienceId));
    
    const isSuccessCluster = cluster.theme === "SUCCESS";
    const strength = isSuccessCluster 
      ? (patternCount > 2 ? HypothesisStrength.VERY_STRONG : HypothesisStrength.STRONG)
      : HypothesisStrength.MODERATE;

    return {
      id: `hypo-${cluster.id}`,
      clusterId: cluster.id,
      summary: `Synthesized ${cluster.theme} operational heuristic based on ${patternCount} pattern(s).`,
      hypothesis: `When executing tasks matching domain '${cluster.theme}', deterministic execution consistently aligns with policy when preconditions are verified.`,
      assumptions: Object.freeze(["Underlying tool connectors remain stable", "Environment configurations are persistent"]),
      limitations: Object.freeze(allContradicting.length > 0 ? [`Observed ${allContradicting.length} contradictory cases`] : []),
      supportingEvidence: Object.freeze(allSupporting),
      strength,
      recommendedScope: KnowledgeScope.DOMAIN
    };
  }

  async synthesizeCandidates(clusters: readonly PatternCluster[]): Promise<SynthesisResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const candidates: KnowledgeCandidate[] = [];

    try {
      for (const cluster of clusters) {
        const hypothesis = await this.formulateHypothesis(cluster);
        const patternIds = cluster.patterns.map(p => p.id);
        const experienceIds = cluster.patterns.flatMap(p => p.supportingEvidence.map(e => e.experienceId));
        const leadPattern = cluster.patterns[0];

        const candidate: KnowledgeCandidate = {
          id: `cand-${cluster.id}`,
          schemaVersion: "1.0.0",
          createdAt: new Date(),
          sourceId: cluster.id,
          context: leadPattern.context,
          metadata: leadPattern.metadata,
          status: CandidateStatus.DRAFT,
          clusterId: cluster.id,
          hypothesisId: hypothesis.id,
          patternIds: Object.freeze(patternIds),
          experienceIds: Object.freeze(experienceIds),
          hypothesis,
          synthesisMetadata: {
            scope: hypothesis.recommendedScope,
            strength: hypothesis.strength,
            synthesisVersion: "1.0.0"
          }
        };

        candidates.push(candidate);
      }
    } catch (err: any) {
      warnings.push(`Synthesis error: ${err.message}`);
    }

    return {
      candidates: Object.freeze(candidates),
      warnings: Object.freeze(warnings),
      durationMs: Date.now() - startedAt
    };
  }
}
