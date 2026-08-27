export interface ArtifactDescriptor {
  readonly name: string;
  readonly type: "BACKEND" | "DATABASE" | "API" | "CONFIG" | "DOCUMENTATION" | "MANIFEST";
  readonly targetPath: string;
}

export interface ExecutionStep {
  readonly stepId: string;
  readonly name: string;
  readonly description: string;
  readonly targetDescriptorName: string;
}

/**
 * IExecutionPlan
 * Kontrak arsitektur tingkat Foundation untuk merinci rencana perakitan artefak logis secara domain-agnostic.
 */
export interface IExecutionPlan {
  readonly executionId: string;
  readonly blueprintId: string;
  readonly steps: ExecutionStep[];
  readonly descriptors: ArtifactDescriptor[];
}
