// src/production/runtime/contracts/IRuntime.ts

import { IRuntimeContext } from "./IRuntimeContext";
import { IRuntimeResult } from "./IRuntimeResult";
import { RuntimeManifest } from "../registry/RuntimeManifest";
import { RuntimeLifecycle } from "./RuntimeLifecycle";

/**
 * The universal contract for all UltimateAI runtimes.
 * Allows the Coordinator to execute any runtime uniformly.
 */
export interface IRuntime<
  TContext extends IRuntimeContext = IRuntimeContext,
  TResult extends IRuntimeResult = IRuntimeResult
> {
  readonly manifest: RuntimeManifest;
  readonly state: RuntimeLifecycle;

  execute(context: TContext): Promise<TResult>;
}
