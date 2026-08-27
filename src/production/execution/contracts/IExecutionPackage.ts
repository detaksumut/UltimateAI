/**
 * IExecutionPackage.ts
 *
 * The artifact loaded by the Execution Kernel. 
 * Contains the Execution Plan and vital verification metadata.
 */

import { IExecutionPlan } from './IExecutionPlan';

export interface IExecutionPackage {
  readonly format: 'UltimateAINative';
  readonly schema_version: string;
  readonly package_version: string;
  
  readonly metadata: {
    readonly workflow_id: string;
    readonly compiled_at: string;
    readonly artifact_checksum: string;
  };
  
  readonly plan: IExecutionPlan;
}
