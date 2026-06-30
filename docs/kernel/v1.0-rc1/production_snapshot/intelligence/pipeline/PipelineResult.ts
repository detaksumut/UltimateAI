// src/production/intelligence/pipeline/PipelineResult.ts

import { Execution } from "../../kernel/execution/Execution";
import { ValidationReport } from "../validation/ValidationReport";
import { CriticEvaluation } from "../critic/CriticEvaluation";
import { ReflectionDecision } from "../reflection/ReflectionDecision";
import { ExecutionChangeSet } from "../repair/ExecutionChangeSet";
import { PipelineTerminationReason } from "./PipelineTerminationReason";
import { PipelineTrace } from "./PipelineTrace";

export interface PipelineMetrics {
  readonly reasoningTimeMs: number;
  readonly planningTimeMs: number;
  readonly validationTimeMs: number;
  readonly criticTimeMs: number;
  readonly reflectionTimeMs: number;
  readonly repairTimeMs: number;
  readonly totalTimeMs: number;
}

/**
 * The final, rich output of the End-to-End Intelligence Pipeline.
 */
export interface PipelineResult {
  /** The final, kernel-ready Execution DAG */
  readonly execution: Execution | null;
  
  /** The final validation report proving structural soundness */
  readonly validationReport: ValidationReport | null;
  
  /** The final evaluation from the Critic */
  readonly criticEvaluation: CriticEvaluation | null;
  
  /** The cumulative decisions made by Reflection across loops */
  readonly reflectionDecisions: readonly ReflectionDecision[];
  
  /** The cumulative change sets applied by Repair */
  readonly changeSets: readonly ExecutionChangeSet[];
  
  /** Execution timings for optimization */
  readonly metrics: PipelineMetrics;
  
  /** Full sequential trace of the pipeline */
  readonly trace: PipelineTrace;
  
  /** Explicit reason for why the pipeline halted */
  readonly terminationReason: PipelineTerminationReason;
}
