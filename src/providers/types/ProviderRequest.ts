export interface ProviderRequest {
  readonly operation: string;
  readonly params: Record<string, any>;
}
