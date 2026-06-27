// src/core/interfaces/IRequest.ts
/**
 * Generic request contract.
 * @template TPayload – type of the payload carried by the request.
 */
export interface IRequest<TPayload = unknown> {
  /** Unique identifier for the request. */
  readonly id: string;
  /** Payload data. */
  readonly payload: TPayload;
}
