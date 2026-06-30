// src/production/providers/contracts/ProviderCapability.ts

/**
 * Defines the generic capabilities an AI Provider can offer.
 * These are capability descriptions, NOT model names.
 * Example: TEXT_GENERATION, IMAGE_GENERATION, EMBEDDING.
 */
export enum ProviderCapability {
  TEXT_GENERATION = "text_generation",
  VISION = "vision",
  FUNCTION_CALLING = "function_calling",
  EMBEDDING = "embedding",
  CODE_GENERATION = "code_generation",
  AUDIO_TRANSCRIBE = "audio_transcribe",
  IMAGE_GENERATION = "image_generation",
}
