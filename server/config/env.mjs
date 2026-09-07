/**
 * env.mjs
 * UltimateAI Local Router Configuration & Environment Management.
 * 100% Local Single Source of Truth.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const LOCAL_ROUTER_HEALTH_PATH = '/health';
export const LOCAL_ROUTER_HEALTH_LEGACY_PATH = '/api/health';
export const LOCAL_ROUTER_HEALTH_PATHS = new Set([
  LOCAL_ROUTER_HEALTH_PATH,
  LOCAL_ROUTER_HEALTH_LEGACY_PATH
]);

export const config = {
  port: parseInt(process.env.PORT || '20200', 10),
  defaultProvider: process.env.ROUTE_PROVIDER || 'gemini',
  localRouter: {
    baseUrl: process.env.LOCAL_ROUTER_URL || 'http://127.0.0.1:20200',
    port: parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10),
    healthPath: LOCAL_ROUTER_HEALTH_PATH,
    healthLegacyPath: LOCAL_ROUTER_HEALTH_LEGACY_PATH
  },
  endpoints: {
    ollama: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  },
  localLLM: {
    enabled: true,
    model: process.env.OLLAMA_MODEL || 'hermes3:8b',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
    maxPromptChars: parseInt(process.env.OLLAMA_MAX_PROMPT_CHARS || '16000', 10)
  },
  route: {
    strategy: process.env.ROUTE_STRATEGY || 'cloud_first',
    provider: process.env.ROUTE_PROVIDER || 'gemini'
  },
  imageGeneration: {
    provider: 'local',
    providerPriority: ['LOCAL_GENERATOR', 'POLLINATIONS']
  }
};

export function getProviderConfigStatus() {
  return {
    ollama: {
      configured: true,
      model: config.localLLM.model,
      endpoint: config.localLLM.baseUrl
    }
  };
}

export default config;
