// src/production/sdk/BaseWorker.ts

import { WorkerContext } from "./WorkerContext";
import { WorkerResult } from "./WorkerResult";
import { WorkerDescriptor } from "../worker/WorkerDescriptor";

/**
 * Abstract base class for all Workers. Implementations must extend this class
 * and provide an immutable {@link WorkerDescriptor} and an {@link execute}
 * method that receives a {@link WorkerContext} and returns a {@link WorkerResult}.
 *
 * The Kernel never creates Workers directly; they are instantiated by a
 * {@link WorkerFactory} in the Infrastructure layer.
 */
export abstract class BaseWorker<C extends WorkerContext = WorkerContext, R extends WorkerResult = WorkerResult> {
  /**
   * The static descriptor describing the Worker type, its capabilities and the
   * task types it can handle. Must be provided by the concrete implementation.
   */
  public abstract readonly descriptor: WorkerDescriptor;

  /**
   * Execute the work. Implementations should be pure business logic and must not
   * depend on Kernel internals.
   */
  public abstract execute(context: C): Promise<R>;
}
