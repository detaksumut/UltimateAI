export type FailureCategory = "Transient" | "Permanent" | "Validation" | "Dependency" | "Timeout" | "Unknown";

export interface FailureClassification {
  category: FailureCategory;
  retryable: boolean;
  checkpointSafe: boolean;
  suggestedDelayMs: number;
}
