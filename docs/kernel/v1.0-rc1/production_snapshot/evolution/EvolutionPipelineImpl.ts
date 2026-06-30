// src/production/evolution/EvolutionPipelineImpl.ts

import { IEvolutionPipeline } from "./IEvolutionPipeline";
import { LearnedKnowledge } from "../learning/promotion/LearnedKnowledge";
import { EvolutionContext } from "./EvolutionContext";
import { IKnowledgeDiscovery } from "./IKnowledgeDiscovery";
import { IEvolutionAnalyzer } from "./IEvolutionAnalyzer";
import { IEvolutionValidator } from "./IEvolutionValidator";
import { IEvolutionPromoter } from "./IEvolutionPromoter";
import { IKnowledgeGraphUpdater } from "./IKnowledgeGraphUpdater";
import { EvolutionPipelineResult } from "./EvolutionPipelineResult";

export class EvolutionPipelineImpl implements IEvolutionPipeline {
  constructor(
    private readonly discoverer: IKnowledgeDiscovery,
    private readonly analyzer: IEvolutionAnalyzer,
    private readonly validator: IEvolutionValidator,
    private readonly promoter: IEvolutionPromoter,
    private readonly graphUpdater: IKnowledgeGraphUpdater
  ) {}

  async evolve(newKnowledge: LearnedKnowledge, context: EvolutionContext): Promise<EvolutionPipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    let analyzed = 0;
    let validated = 0;
    let created = 0;
    let superseded = 0;
    let archived = 0;
    let graphUpdates = 0;

    // 1. Discovery
    const discoveryResult = await this.discoverer.discover(context);
    warnings.push(...discoveryResult.warnings);
    const relevantKnowledge = discoveryResult.knowledge;
    
    // Construct an augmented context that includes discovered knowledge
    const enrichedContext: EvolutionContext = {
      ...context,
      existingKnowledge: relevantKnowledge
    };

    if (relevantKnowledge.length === 0) {
      // Nothing to evolve against, knowledge is simply saved/active.
      // E.g., it's a completely novel piece of knowledge.
      return {
        pipelineId: context.pipelineId,
        discovered: 0,
        analyzed: 0,
        validated: 0,
        created: 0,
        superseded: 0,
        archived: 0,
        graphUpdates: 0,
        executionTimeMs: Date.now() - startTime,
        warnings
      };
    }

    // 2. Analysis (AI)
    const hypotheses = await this.analyzer.analyze(enrichedContext);

    for (const hypothesis of hypotheses) {
      analyzed++;
      // 3. Validation (Deterministic)
      const report = await this.validator.validate(hypothesis, enrichedContext);
      
      if (report.passed) {
        validated++;
        // 4. Promotion (Creation of new payloads & status commands)
        const result = await this.promoter.promote(hypothesis, report, enrichedContext);
        
        // 5. Graph Updates & Execution of Status Commands (Repository interactions)
        for (const operation of result.operations) {
          if (operation.type === "UPDATE_STATUS") {
            if (operation.newStatus === "ARCHIVED") archived++;
            if (operation.newStatus === "SUPERSEDED") superseded++;
          }
          if (operation.type === "CREATE_EDGE") {
            graphUpdates++;
          }
        }
        
        // Save newly evolved knowledge if any
        if (result.newKnowledge) {
          await context.repository.save(result.newKnowledge);
          created++;
        }
        
        // Update Graph
        if (result.operations.length > 0) {
          await this.graphUpdater.updateGraph(result.operations, enrichedContext);
        }
      }
    }

    return {
      pipelineId: context.pipelineId,
      discovered: relevantKnowledge.length,
      analyzed,
      validated,
      created,
      superseded,
      archived,
      graphUpdates,
      executionTimeMs: Date.now() - startTime,
      warnings
    };
  }
}
