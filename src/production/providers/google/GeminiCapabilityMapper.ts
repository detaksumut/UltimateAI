// src/production/providers/google/GeminiCapabilityMapper.ts

import { ProviderCapability } from "../contracts/ProviderCapability";

/**
 * Maps UltimateAI's generic capabilities to Google's specific models.
 * Implements a many-to-many or one-to-many mapping.
 */
export class GeminiCapabilityMapper {
  private static capabilityToModelsMap: Record<ProviderCapability, string[]> = {
    [ProviderCapability.TEXT_GENERATION]: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
    [ProviderCapability.VISION]: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
    [ProviderCapability.FUNCTION_CALLING]: ["gemini-2.5-pro", "gemini-2.5-flash"],
    [ProviderCapability.EMBEDDING]: ["text-embedding-004"],
    [ProviderCapability.CODE_GENERATION]: ["gemini-2.5-pro", "gemini-2.5-flash"],
    [ProviderCapability.AUDIO_TRANSCRIBE]: ["gemini-2.5-pro", "gemini-1.5-pro"],
    [ProviderCapability.IMAGE_GENERATION]: ["imagen-3.0-generate-001"],
  };

  /**
   * Resolves the best Google model for a given generic capability.
   */
  public static getModelsForCapability(capability: ProviderCapability): string[] {
    return this.capabilityToModelsMap[capability] || [];
  }

  /**
   * Selects a single default model for a capability (e.g., picking the top model).
   */
  public static getDefaultModelForCapability(capability: ProviderCapability): string | undefined {
    const models = this.getModelsForCapability(capability);
    return models.length > 0 ? models[0] : undefined;
  }
}
