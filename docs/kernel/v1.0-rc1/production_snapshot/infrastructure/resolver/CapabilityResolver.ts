// src/production/infrastructure/resolver/CapabilityResolver.ts
import { WorkerCapability } from "../../sdk/WorkerCapability";
import { Task } from "../../kernel/task/Task";

/**
 * Maps a Task to one or more required WorkerCapability values.
 * The mapping is pure data – concrete implementations will provide the map.
 */
export interface CapabilityResolver {
  /** Resolve capabilities required for the given task. */
  resolveCapabilities(task: Task): readonly WorkerCapability[];
}
