// src/engine/models/aiRequestFactory.ts

/**
 * Factory responsible for creating {@link AIRequest} objects.
 * Centralises defaults and guarantees the required capability set.
 */
import { AIRequest, AIMessage } from './aiRequest';
import { AICapability } from '../capability/types';

export class AIRequestFactory {
  /**
   * Creates a chat request for the given model and messages.
   *
   * @param model           The model identifier (e.g. "9router-ultimate").
   * @param messages        Ordered list of chat messages.
   * @param stream          Whether the provider should stream the response. Defaults to false.
   * @returns               A fully‑formed {@link AIRequest} with the CHAT capability.
   */
  public static createChatRequest(params: {
    model: string;
    messages: AIMessage[];
    stream?: boolean;
  }): AIRequest {
    const { model, messages, stream = false } = params;
    return {
      model,
      messages,
      stream,
      capabilities: new Set([AICapability.CHAT]),
    };
  }
}
