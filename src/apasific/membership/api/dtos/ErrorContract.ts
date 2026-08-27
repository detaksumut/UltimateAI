export interface ApiErrorContract {
  code: string;
  message: string;
  details?: string[];
  traceId: string;
  timestamp: string;
}

/**
 * Maps Internal Domain Exceptions into the strict API Error Contract.
 */
export class ErrorMapper {
  public static mapToContract(error: Error, traceId: string): ApiErrorContract {
    // In reality, this would switch on custom error types (DomainError, NotFoundError, etc)
    return {
      code: 'MEMBERSHIP_ERR_500',
      message: error.message || 'An unexpected error occurred.',
      traceId: traceId,
      timestamp: new Date().toISOString()
    };
  }
}
