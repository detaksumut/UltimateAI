// src/core/interfaces/IComponent.ts
/**
 * Base contract for any injectable component.
 * Components are identified by a unique key and can expose a public API.
 */
export interface IComponent<TPublic = unknown> {
  /** Unique component identifier (often the class name). */
  readonly key: string;
  /** The public API surface of the component. */
  readonly api: TPublic;
}
