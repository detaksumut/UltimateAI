// src/execution/models/CancellationToken.ts

/**
 * Interface representing a cancellation token that can check if cancellation is requested.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
}
