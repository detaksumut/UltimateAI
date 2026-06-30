// src/production/execution/contracts/ExecutionBlueprint.ts

import { BlueprintGoal } from "./BlueprintGoal";
import { IExecutionStrategy } from "./IExecutionStrategy";
import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";

/**
 * The high-level intent describing WHAT to do, formulated by the Planning Runtime.
 */
export interface ExecutionBlueprint extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  /** The unique ID of this blueprint */
  readonly blueprintId: string;
  
  readonly goal: BlueprintGoal;
  readonly strategies: readonly IExecutionStrategy[];
  
  /** Identifies any missing capabilities that might cause this blueprint to fail */
  readonly missingCapabilities: readonly string[];
  
  readonly expectedOutcomes: readonly string[];
}
