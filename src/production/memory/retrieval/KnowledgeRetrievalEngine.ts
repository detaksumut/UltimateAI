import { MemoryPolicy } from "../contracts/MemoryPolicy";
import { RetrievalStrategy } from "../contracts/RetrievalStrategy";
import { RetrievedContext } from "../contracts/RetrievedContext";
import { CandidateGenerator } from "./CandidateGenerator";
import { RankingEngine } from "./RankingEngine";
import { ArtifactRepository } from "../../artifact/repository/ArtifactRepository";
import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";

export class KnowledgeRetrievalEngine {
  constructor(
    private readonly eventBus: IRuntimeEventBus,
    private readonly candidateGenerator: CandidateGenerator,
    private readonly rankingEngine: RankingEngine,
    private readonly artifactRepo: ArtifactRepository
  ) {}

  async retrieve(
    contextId: string, 
    strategy: RetrievalStrategy, 
    policy: MemoryPolicy, 
    traceId: string
  ): Promise<RetrievedContext[]> {
    this.eventBus.publish({
      eventId: `mem-start-${Date.now()}`,
      traceId,
      eventType: "RetrievalStarted",
      timestamp: Date.now(),
      payload: { contextId, strategy, policy }
    });

    // 1. Candidate Generation
    const candidates = await this.candidateGenerator.generate(strategy, contextId, policy);
    
    this.eventBus.publish({
      eventId: `mem-cand-${Date.now()}`,
      traceId,
      eventType: "CandidateGenerated",
      timestamp: Date.now(),
      payload: { count: candidates.length }
    });

    // 2. Ranking
    let ranked = this.rankingEngine.rank(candidates, strategy, policy);
    
    // 3. Memory Policy (Cross Workflow filtering & Limits)
    if (!policy.allowCrossWorkflow) {
      ranked = ranked.filter(r => r.node.metadata?.traceId === traceId || !r.node.metadata?.traceId);
    }
    
    // Slice to maxContextArtifacts
    ranked = ranked.slice(0, policy.maxContextArtifacts);

    this.eventBus.publish({
      eventId: `mem-rank-${Date.now()}`,
      traceId,
      eventType: "RankingCompleted",
      timestamp: Date.now(),
      payload: { finalCount: ranked.length }
    });

    // 4. Hydration (Fetching payloads from Artifact Repository)
    const results: RetrievedContext[] = [];
    for (const r of ranked) {
      const artifact = await this.artifactRepo.getLatest(r.node.artifactId);
      if (artifact) {
        results.push({
          artifact,
          ranking: r.ranking,
          knowledgePath: r.knowledgePath
        });
      }
    }

    this.eventBus.publish({
      eventId: `mem-end-${Date.now()}`,
      traceId,
      eventType: "ContextReturned",
      timestamp: Date.now(),
      payload: { 
        returnedArtifacts: results.map(r => ({ id: r.artifact.identity.id, score: r.ranking.score })) 
      }
    });

    return results;
  }
}
