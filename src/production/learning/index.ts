// src/production/learning/index.ts

// ==========================================
// 1. Contracts & Models
// ==========================================
export { ILearningArtifact } from "./contracts/ILearningArtifact";
export { ITraceableArtifact } from "./contracts/ITraceableArtifact";

// ==========================================
// 2. Experience Domain
// ==========================================
export { Experience } from "./experience/Experience";
export { ExperienceContext } from "./experience/ExperienceContext";
export { ExperienceMetadata } from "./experience/ExperienceMetadata";
export { ExperienceOutcome } from "./experience/ExperienceOutcome";
export { ExtractionResult } from "./experience/ExtractionResult";
export { IExperienceExtractor } from "./experience/IExperienceExtractor";
export { ExperienceExtractorImpl } from "./experience/ExperienceExtractorImpl";

// ==========================================
// 3. Pattern Domain
// ==========================================
export { LearningPattern } from "./pattern/LearningPattern";
export { PatternAnalysisResult } from "./pattern/PatternAnalysisResult";
export { PatternConfidence } from "./pattern/PatternConfidence";
export { PatternEvidence } from "./pattern/PatternEvidence";
export { PatternType } from "./pattern/PatternType";
export { IPatternAnalyzer } from "./pattern/IPatternAnalyzer";
export { PatternAnalyzerImpl } from "./pattern/PatternAnalyzerImpl";

// ==========================================
// 4. Synthesis Domain
// ==========================================
export { CandidateMetadata } from "./synthesis/CandidateMetadata";
export { CandidateStatus } from "./synthesis/CandidateStatus";
export { HypothesisStrength } from "./synthesis/HypothesisStrength";
export { KnowledgeCandidate } from "./synthesis/KnowledgeCandidate";
export { KnowledgeHypothesis } from "./synthesis/KnowledgeHypothesis";
export { KnowledgeScope } from "./synthesis/KnowledgeScope";
export { PatternCluster } from "./synthesis/PatternCluster";
export { SynthesisResult } from "./synthesis/SynthesisResult";
export { IKnowledgeSynthesizer } from "./synthesis/IKnowledgeSynthesizer";
export { KnowledgeSynthesizerImpl } from "./synthesis/KnowledgeSynthesizerImpl";

// ==========================================
// 5. Validation Domain
// ==========================================
export { ILearningValidator } from "./validation/ILearningValidator";
export { LearningValidatorImpl } from "./validation/LearningValidatorImpl";
export { RuleCategory } from "./validation/RuleCategory";
export { RuleResult } from "./validation/RuleResult";
export { RuleSeverity } from "./validation/RuleSeverity";
export { ValidationContext } from "./validation/ValidationContext";
export { ValidationPolicy } from "./validation/ValidationPolicy";
export { ValidationReport } from "./validation/ValidationReport";
export { ValidationRule } from "./validation/ValidationRule";

// ==========================================
// 6. Promotion Domain
// ==========================================
export { IKnowledgePromoter } from "./promotion/IKnowledgePromoter";
export { KnowledgePromoterImpl } from "./promotion/KnowledgePromoterImpl";
export { KnowledgeOrigin } from "./promotion/KnowledgeOrigin";
export { KnowledgeProvenance } from "./promotion/KnowledgeProvenance";
export { KnowledgeStatus } from "./promotion/KnowledgeStatus";
export { KnowledgeVersion } from "./promotion/KnowledgeVersion";
export { LearnedKnowledge } from "./promotion/LearnedKnowledge";
export { PromotionDecision } from "./promotion/PromotionDecision";
export { PromotionPolicy } from "./promotion/PromotionPolicy";
export { PromotionResult } from "./promotion/PromotionResult";

// ==========================================
// 7. Repository Domain
// ==========================================
export { ILearnedKnowledgeRepository } from "./repository/ILearnedKnowledgeRepository";
export { SQLiteLearnedKnowledgeRepository } from "./repository/SQLiteLearnedKnowledgeRepository";

// ==========================================
// 8. Pipeline Domain
// ==========================================
export { ILearningPipeline } from "./pipeline/ILearningPipeline";
export { LearningPipelineContext } from "./pipeline/LearningPipelineContext";
export { LearningPipelineResult } from "./pipeline/LearningPipelineResult";
export { LearningPipelineImpl } from "./pipeline/LearningPipelineImpl";
