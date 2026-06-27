export interface ProviderCapabilities {
  readonly supportedOperations: string[];
  readonly maxTokens?: number;
  readonly supportedModels?: string[];
  readonly metadata?: Record<string, any>;
}
