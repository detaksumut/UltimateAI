// src/production/providers/contracts/ProviderFeatures.ts

/**
 * Descriptive features that an AI provider might support.
 * Unlike capabilities (which dictate WHAT a system needs), features describe
 * HOW the provider can behave (e.g., streaming, structured output).
 */
export enum ProviderFeature {
  STREAMING = "streaming",
  FUNCTION_CALLING = "function_calling",
  STRUCTURED_OUTPUT = "structured_output",
  VISION = "vision",
  VIDEO_GENERATION = "video_generation",
  AUDIO_GENERATION = "audio_generation",
  AUDIO_UNDERSTANDING = "audio_understanding",
}
