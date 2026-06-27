// src/core/interfaces/IResponse.ts
/**
 * Generic response contract.
 * @template TPayload – type of response payload.
 */
export interface IResponse<TPayload = unknown> {
  /** Unique identifier matching the request. */
  readonly requestId: string;
  /** Payload data. */
  readonly payload: TPayload;
  /** Indicates whether the operation succeeded. */
  readonly success: boolean;
  /** Optional error message when success is false. */
  readonly error?: string;
}
