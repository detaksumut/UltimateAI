// src/production/providers/google/GeminiResponse.ts

import { GeminiContent } from "./GeminiRequest";

/**
 * Represents the native Google Gemini API response structure.
 * Completely isolated from UltimateAI's ProviderResponse.
 */
export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: GeminiUsageMetadata;
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
}

export interface GeminiPromptFeedback {
  blockReason?: string;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}
