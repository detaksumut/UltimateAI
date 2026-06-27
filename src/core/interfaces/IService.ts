// src/core/interfaces/IService.ts
/**
 * Base contract for a service component.
 * @template TConfig – configuration shape required to start the service.
 */
export interface IService<TConfig = unknown> {
  /** Initialise the service with the provided configuration. */
  start(config: TConfig): Promise<void>;
  /** Gracefully stop the service. */
  stop(): Promise<void>;
}
