// src/engine/models/aiRequest.ts
// Domain model representing a request passed to a provider.

import { AICapability } from '../capability/types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  model: string;
  messages: AIMessage[];
  stream: boolean;
  /** Set of capabilities required for this request – currently only CHAT */
  capabilities: Set<AICapability>;
  // Future extensions can add temperature, top_p, etc.
}
