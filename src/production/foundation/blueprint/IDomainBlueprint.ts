export type BlueprintStatus = "DRAFT" | "VALIDATED" | "REGISTERED" | "APPROVED" | "EXECUTED" | "ARCHIVED";

export interface BlueprintMetadata {
  readonly createdAt: number;
  readonly createdBy: string;
  readonly foundationBaseline: string;
  readonly generatorVersion: string;
  readonly domainVersion: string;
}

/**
 * IDomainBlueprint
 * Kontrak arsitektur generik tingkat Foundation.
 * Bersifat immutable dan mewakili spesifikasi solusi logis sebelum diwujudkan oleh Execution.
 */
export interface IDomainBlueprint {
  readonly blueprintId: string;
  readonly schemaVersion: string;
  readonly foundationBaseline: string;
  readonly domain: string;
  readonly classification: string; // e.g. "domain"
  readonly type: string;           // e.g. "Reference Blueprint" or "Production Blueprint"
  readonly status: BlueprintStatus;
  readonly analysisId: string;     // Penelusuran rantai kognitif dari DomainAnalysisResult
  readonly metadata: BlueprintMetadata;
  readonly specification: Record<string, any>;
  readonly blueprintHash: string;  // SHA-256 hash dari (Schema + Specification + Metadata)
}
