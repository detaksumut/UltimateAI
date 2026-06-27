export interface ProviderResponse<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: any;
  };
  readonly metadata?: Record<string, any>;
}
