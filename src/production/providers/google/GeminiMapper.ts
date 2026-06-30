// src/production/providers/google/GeminiMapper.ts

import { ProviderRequest } from "../contracts/ProviderRequest";
import { ProviderResponse } from "../contracts/ProviderResponse";
import { GeminiRequest, GeminiContent } from "./GeminiRequest";
import { GeminiResponse } from "./GeminiResponse";

/**
 * Translates between UltimateAI generic contracts and Google Gemini specific contracts.
 */
export class GeminiMapper {
  
  /**
   * Maps a generic ProviderRequest into a vendor-specific GeminiRequest.
   */
  public static mapRequest(request: ProviderRequest): GeminiRequest {
    const contents: GeminiContent[] = [
      {
        role: "user",
        parts: [{ text: request.instruction }]
      }
    ];

    let systemInstruction: GeminiContent | undefined;
    if (request.context && typeof request.context === "string") {
      systemInstruction = {
        role: "system",
        parts: [{ text: request.context }]
      };
    }

    return {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: request.options?.temperature as number | undefined,
        maxOutputTokens: request.options?.maxTokens as number | undefined,
      }
    };
  }

  /**
   * Maps a vendor-specific GeminiResponse back into a generic ProviderResponse.
   */
  public static mapResponse(response: GeminiResponse): ProviderResponse {
    let status: "success" | "partial" | "error" = "success";
    const outputs: string[] = [];
    const errors: unknown[] = [];

    if (!response.candidates || response.candidates.length === 0) {
      status = "error";
      errors.push(response.promptFeedback?.blockReason || "No candidates returned");
    } else {
      for (const candidate of response.candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              outputs.push(part.text);
            }
          }
        }
        if (candidate.finishReason !== "STOP") {
          status = "partial"; // e.g. MAX_TOKENS
        }
      }
    }

    return {
      status,
      outputs,
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
