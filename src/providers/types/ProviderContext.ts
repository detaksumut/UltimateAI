export interface ProviderContext {
  readonly traceId?: string;
  readonly cancellationSignal?: AbortSignal;
  readonly userId?: string;
  readonly metadata?: Record<string, any>;
}
