// src/engine/models/aiResponse.ts

/**
 * Canonical AI response format used throughout UltimateAI.
 * Mirrors OpenAI's Chat Completion response for compatibility.
 */
export interface AIChoiceMessage {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

export interface AIChoice {
  index: number;
  message: AIChoiceMessage;
  finish_reason?: string;
  // Additional fields can be added later (e.g., logprobs)
}

export interface AIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIResponse {
  id: string;
  object: string;
  created: number; // epoch seconds
  model: string;
  usage: AIUsage;
  choices: AIChoice[];
  // Preserve raw provider payload for debugging
  raw?: unknown;
}
