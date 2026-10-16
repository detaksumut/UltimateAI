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
  defaultProvider: process.env.ROUTE_PROVIDER || 'ninerouter',
  localRouter: {
    baseUrl: process.env.LOCAL_ROUTER_URL || 'http://127.0.0.1:20200',
    port: parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10),
    healthPath: LOCAL_ROUTER_HEALTH_PATH,
    healthLegacyPath: LOCAL_ROUTER_HEALTH_LEGACY_PATH
  },
  endpoints: {
    llamacpp: process.env.LLAMACPP_HOST || 'http://127.0.0.1:8080',
    ninerouter: process.env.NINEROUTER_URL || 'http://127.0.0.1:20128'
  },
  localLLM: {
    enabled: true,
    model: process.env.NINEROUTER_CHAT_MODEL || process.env.LLAMACPP_MODEL || 'auto',
    baseUrl: process.env.NINEROUTER_URL || 'http://127.0.0.1:20128',
    timeoutMs: parseInt(process.env.LLAMACPP_TIMEOUT_MS || '120000', 10),
    maxPromptChars: parseInt(process.env.LLAMACPP_MAX_PROMPT_CHARS || '48000', 10)
  },
  route: {
    strategy: process.env.ROUTE_STRATEGY || 'local_first',
    provider: process.env.ROUTE_PROVIDER || 'ninerouter'
  },
  imageGeneration: {
    provider: 'ninerouter',
    providerPriority: ['NINEROUTER']
  },
  ninerouter: {
    url: process.env.NINEROUTER_URL || 'http://127.0.0.1:20128',
    keyConfigured: Boolean(process.env.NINEROUTER_KEY && String(process.env.NINEROUTER_KEY).trim().length > 0)
  }
};

export function getProviderConfigStatus() {
  return {
    llamacpp: {
      configured: true,
      model: config.localLLM.model,
      endpoint: config.localLLM.baseUrl
    }
  };
}

export default config;
