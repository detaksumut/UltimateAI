// src/production/intelligence/contracts/TraceableArtifact.ts

import { KnowledgeProjectionType } from "../../knowledge/projection/KnowledgeProjectionType";

/**
 * Base interface for all major Intelligence artifacts.
 * Establishes a "Decision Ledger" ensuring full auditability, observability,
 * and explainability across the entire intelligence pipeline.
 */
export interface TraceableArtifact {
  /** Unique identifier for this specific artifact instance */
  readonly id: string;
  
  /** Identifier tracing the entire end-to-end request lifecycle */
  readonly correlationId: string;
  
  /** The specific engine or component that produced this artifact */
  readonly source: string;
  
  /** Timestamp of creation */
  readonly createdAt: Date;

  /** Defines how this artifact is projected into the Knowledge Runtime */
  readonly projectionType?: KnowledgeProjectionType;
}
