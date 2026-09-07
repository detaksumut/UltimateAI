// src/production/learning/pipeline/LearningPipelineImpl.ts

import { ILearningPipeline } from "./ILearningPipeline";
import { ReconstructionResult } from "../../knowledge/reconstruction/ReconstructionResult";
import { LearningPipelineContext } from "./LearningPipelineContext";
import { LearningPipelineResult } from "./LearningPipelineResult";

import { IExperienceExtractor } from "../experience/IExperienceExtractor";
import { IPatternAnalyzer } from "../pattern/IPatternAnalyzer";
import { IKnowledgeSynthesizer } from "../synthesis/IKnowledgeSynthesizer";
import { ILearningValidator } from "../validation/ILearningValidator";
import { IKnowledgePromoter } from "../promotion/IKnowledgePromoter";
import { ILearnedKnowledgeRepository } from "../repository/ILearnedKnowledgeRepository";
import { ValidationContext } from "../validation/ValidationContext";
import { PromotionPolicy } from "../promotion/PromotionPolicy";
import { PromotionDecision } from "../promotion/PromotionDecision";

export class LearningPipelineImpl implements ILearningPipeline {
  constructor(
    private readonly extractor: IExperienceExtractor,
    private readonly analyzer: IPatternAnalyzer,
    private readonly synthesizer: IKnowledgeSynthesizer,
    private readonly validator: ILearningValidator,
    private readonly promoter: IKnowledgePromoter,
    private readonly repository: ILearnedKnowledgeRepository
  ) {}

  async process(reconstruction: ReconstructionResult, context: LearningPipelineContext): Promise<LearningPipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    
    // 1. Extraction (Deterministic)
    const extractionResult = await this.extractor.extract(reconstruction);
    warnings.push(...extractionResult.warnings);
    
    if (extractionResult.experiences.length === 0) {
      return this.createResult(context, extractionResult.experiences.length, 0, 0, 0, 0, 0, startTime, warnings);
    }

    // 2. Pattern Analysis (AI)
    const analysisResult = await this.analyzer.analyze(extractionResult.experiences);
    warnings.push(...analysisResult.warnings);
    
    if (analysisResult.patterns.length === 0) {
      return this.createResult(context, extractionResult.experiences.length, 0, 0, 0, 0, 0, startTime, warnings);
    }

    // 3. Synthesis (AI)
    const clusters = await this.synthesizer.clusterPatterns(analysisResult.patterns);
    if (clusters.length === 0) {
      return this.createResult(context, extractionResult.experiences.length, analysisResult.patterns.length, 0, 0, 0, 0, startTime, warnings);
    }
    const synthesisResult = await this.synthesizer.synthesizeCandidates(clusters);
    warnings.push(...synthesisResult.warnings);
    
    if (synthesisResult.candidates.length === 0) {
      return this.createResult(context, extractionResult.experiences.length, analysisResult.patterns.length, 0, 0, 0, 0, startTime, warnings);
    }

    // 4. Validation & 5. Promotion (Deterministic)
    let validatedCount = 0;
    let promotedCount = 0;
    let archivedCount = 0;

    const validationContext: ValidationContext = {
      policy: context.configuration?.validationPolicy || {
        minimumConfidenceScore: 0.65,
        minimumCoverageCount: 1,
        maximumContradictionRatio: 0.3,
        maximumExperienceAgeMs: 30 * 24 * 60 * 60 * 1000
      },
      currentTimeMs: Date.now()
    };

    const promotionPolicy: PromotionPolicy = context.configuration?.promotionPolicy || {
      archiveSuperseded: true,
      requireHumanApprovalForGlobalScope: false,
      minimumStrengthForGlobal: "STRONG" as any,
      conflictResolutionStrategy: "LATEST_WINS" as any,
      defaultVersionStrategy: "PATCH" as any,
      targetRepository: "DEFAULT_REPOSITORY"
    };

    for (const candidate of synthesisResult.candidates) {
      // Validation
      const report = await this.validator.validate(candidate, validationContext);
      if (report.passed) {
        validatedCount++;
        
        // Promotion
        const promotionResult = await this.promoter.promote(candidate, report, promotionPolicy);
        warnings.push(...promotionResult.warnings);
        
        if (promotionResult.decision === PromotionDecision.PROMOTED || promotionResult.decision === PromotionDecision.REPLACED) {
           if (promotionResult.knowledge) {
             await this.repository.save(promotionResult.knowledge);
             promotedCount++;
           }
        } else if (promotionResult.decision === PromotionDecision.ARCHIVED) {
           archivedCount++;
        }
      }
    }

    return this.createResult(context, extractionResult.experiences.length, analysisResult.patterns.length, synthesisResult.candidates.length, validatedCount, promotedCount, archivedCount, startTime, warnings);
  }

  private createResult(
    context: LearningPipelineContext,
    expCount: number, patCount: number, candCount: number, valCount: number,
    promCount: number, archCount: number, startTime: number, warnings: string[]
  ): LearningPipelineResult {
    return {
      pipelineId: context.pipelineId,
      experienceCount: expCount,
      patternCount: patCount,
      candidateCount: candCount,
      validatedCount: valCount,
      promotedCount: promCount,
      archivedCount: archCount,
      executionTimeMs: Date.now() - startTime,
      warnings
    };
  }
}
