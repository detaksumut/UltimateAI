// src/production/providers/google/GeminiProvider.ts

import { IAIProvider } from "../contracts/IAIProvider";
import { ProviderRequest } from "../contracts/ProviderRequest";
import { ProviderResponse } from "../contracts/ProviderResponse";
import { ProviderMetadata } from "../contracts/ProviderMetadata";
import { ProviderHealth, ProviderHealthStatus } from "../contracts/ProviderHealth";
import { ProviderConfiguration } from "../contracts/ProviderConfiguration";
import { ProviderFeature } from "../contracts/ProviderFeatures";
import { ProviderCapability } from "../contracts/ProviderCapability";

import { GeminiMapper } from "./GeminiMapper";
import { GeminiErrorMapper } from "./GeminiErrorMapper";
import { GeminiCapabilityMapper } from "./GeminiCapabilityMapper";
import { GeminiTransport } from "./GeminiTransport";

/**
 * The reference implementation for a Google Gemini Provider.
 * This adapter is deliberately thin; it delegates to mappers and transport.
 */
export class GeminiProvider implements IAIProvider {
  
  public readonly metadata: ProviderMetadata;
  
  private readonly config: ProviderConfiguration;
  private readonly transport: GeminiTransport;
  private readonly apiKey: string; // Injected by infrastructure, never exposed via contracts

  constructor(config: ProviderConfiguration, apiKey: string) {
    this.config = config;
    this.apiKey = apiKey;
    this.transport = new GeminiTransport();
    
    this.metadata = {
      providerId: "google",
      providerName: "Google AI",
      version: "1.0.0",
      supportedCapabilities: [
        ProviderCapability.TEXT_GENERATION,
        ProviderCapability.VISION,
        ProviderCapability.FUNCTION_CALLING,
        ProviderCapability.EMBEDDING,
        ProviderCapability.CODE_GENERATION,
        ProviderCapability.AUDIO_TRANSCRIBE,
        ProviderCapability.IMAGE_GENERATION,
      ],
      features: [
        ProviderFeature.STREAMING,
        ProviderFeature.FUNCTION_CALLING,
        ProviderFeature.STRUCTURED_OUTPUT,
        ProviderFeature.VISION,
      ],
      supportedModalities: ["text", "image", "audio"],
    };
  }

  public async generate(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      // 1. Resolve Model
      let model = request.options?.modelId as string | undefined;
      if (!model) {
        model = GeminiCapabilityMapper.getDefaultModelForCapability(request.capability);
      }
      
      if (!model) {
        throw new Error(`No default model found for capability: ${request.capability}`);
      }

      // 2. Map Request
      const geminiRequest = GeminiMapper.mapRequest(request);

      // 3. Execute Transport
      const geminiResponse = await this.transport.execute(geminiRequest, model, this.config, this.apiKey);

      // 4. Map Response
      return GeminiMapper.mapResponse(geminiResponse);

    } catch (error) {
      // 5. Map Errors
      throw GeminiErrorMapper.mapError(error);
    }
  }

  public async checkHealth(): Promise<ProviderHealth> {
    try {
      // Minimal implementation, e.g. ping the models endpoint or just return ONLINE
      return {
        status: ProviderHealthStatus.ONLINE,
        lastCheckedAt: new Date(),
        message: "Gemini provider is available"
      };
    } catch (error) {
      return {
        status: ProviderHealthStatus.OFFLINE,
        lastCheckedAt: new Date(),
        message: error instanceof Error ? error.message : "Unknown error during health check"
      };
    }
  }
}
