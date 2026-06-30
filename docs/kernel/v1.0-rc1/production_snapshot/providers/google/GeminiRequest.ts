// src/production/providers/google/GeminiRequest.ts

/**
 * Represents the native Google Gemini API request structure.
 * This is completely isolated from UltimateAI's ProviderRequest.
 */
export interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiContent {
  role: "user" | "model" | "system";
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}
