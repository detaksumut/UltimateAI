// src/production/providers/google/GeminiTransport.ts

import { GeminiRequest } from "./GeminiRequest";
import { GeminiResponse } from "./GeminiResponse";
import { ProviderConfiguration } from "../contracts/ProviderConfiguration";

/**
 * Handles pure I/O communication with Google APIs.
 * It is completely unaware of UltimateAI abstractions like ProviderRequest/Response.
 */
export class GeminiTransport {
  /**
   * Executes the HTTP request to the Google API endpoint.
   * Throws raw errors which will be caught and mapped by the Provider.
   */
  public async execute(
    request: GeminiRequest, 
    model: string, 
    config: ProviderConfiguration, 
    apiKey: string
  ): Promise<GeminiResponse> {
    
    // Default endpoint handling. In reality, you'd use Google's defined endpoints
    const baseUrl = config.endpoint || "https://generativelanguage.googleapis.com/v1beta/models";
    const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as GeminiResponse;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
