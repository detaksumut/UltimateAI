// src/production/intelligence/contracts/IReasoningService.ts

/**
 * Abstraction for AI reasoning capabilities.
 * The ReasoningEngine uses this service to think, isolating the engine
 * from the Infrastructure Runtime and specific AI Providers.
 */
export interface IReasoningService {
  /**
   * Prompts the underlying AI with structured instructions and context,
   * returning the generic result. The service is responsible for mapping
   * this to the Infrastructure Runtime -> Provider.
   */
  reason(prompt: string, context?: unknown): Promise<unknown>;
}
