// src/core/interfaces/IContext.ts
/**
 * Generic context contract that can hold arbitrary scoped data.
 * @template TData – shape of the context data.
 */
export interface IContext<TData = unknown> {
  /** Unique identifier for the context instance. */
  readonly id: string;
  /** Read‑only snapshot of the stored data. */
  readonly data: Readonly<TData>;
}
