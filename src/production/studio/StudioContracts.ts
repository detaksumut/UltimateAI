import { StudioContext } from "./StudioContext";
import { ExplainabilityRecord } from "../generator/DecisionEngine";
import { PipelineTrace } from "../orchestrator/ObservabilityTracer";
import { SolutionArchitecture } from "../generator/SolutionArchitect";
import { IDomainBlueprint } from "../foundation/blueprint/IDomainBlueprint";

// ─── Request ──────────────────────────────────────────────────────────────────

export interface StudioRequest {
  /** Natural language description of what to build. */
  readonly naturalLanguage: string;
  /** Caller identity and permissions (optional; defaults to ANONYMOUS_CONTEXT). */
  readonly context?: StudioContext;
  /** Queue priority. Defaults to "normal". */
  readonly priority?: "high" | "normal" | "low";
  /** Evaluate policies as they existed on this ISO date (for historical replay). */
  readonly asOf?: string;
  /** If true, run the full pipeline but skip artifact generation. */
  readonly dryRun?: boolean;
  /** Maximum total execution time in ms. */
  readonly maxTimeMs?: number;
  /** Arbitrary labels for filtering and audit. */
  readonly tags?: string[];
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type StudioStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";

export interface StudioResult {
  readonly requestId: string;
  readonly status: StudioStatus;
  readonly certificateId?: string;
  readonly explanation: ExplainabilityRecord;
  readonly trace: PipelineTrace;
  readonly artifactCount: number;
  readonly repairCount: number;
  /** True when the result was returned from the idempotency cache. */
  readonly cached: boolean;
  readonly tags?: string[];
  readonly completedAt: string;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

export interface PreviewResult {
  readonly requestId: string;
  /** Natural language input that was previewed. */
  readonly naturalLanguage: string;
  /** Blueprint produced by BlueprintPlanner (no artifact generation). */
  readonly blueprint: IDomainBlueprint;
  /** Technology strategy with full explainability. */
  readonly explanation: ExplainabilityRecord;
  /** Service topology designed by SolutionArchitect. */
  readonly architecture: SolutionArchitecture;
  /** Estimated number of artifacts that would be generated in a full run. */
  readonly estimatedArtifactCount: number;
  readonly previewedAt: string;
}

// ─── Export/Import ────────────────────────────────────────────────────────────

export type ExportFormat = "json" | "yaml" | "markdown" | "zip";

export interface ExportBundle {
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly content: string;   // serialized payload
  readonly exportedAt: string;
}

export interface ImportBundle {
  readonly requestId: string;
  readonly result: StudioResult;
  readonly importedAt: string;
}
