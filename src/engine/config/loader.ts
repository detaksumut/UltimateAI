// src/engine/config/loader.ts
// Loads environment variables and provides a strongly typed Config object with defaults.

import * as dotenv from 'dotenv';
dotenv.config();

export interface Config {
  AI_PROVIDER: string;
  NINE_ROUTER_URL: string;
  NINE_ROUTER_API_KEY: string;
  NINE_ROUTER_MODEL: string;
  TIMEOUT_MS: number;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY_MS: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

export const config: Config = {
  AI_PROVIDER: process.env.AI_PROVIDER ?? '9router',
  NINE_ROUTER_URL: process.env.NINE_ROUTER_URL ?? 'http://localhost:20128/v1',
  NINE_ROUTER_API_KEY: process.env.NINE_ROUTER_API_KEY ?? '',
  NINE_ROUTER_MODEL: process.env.NINE_ROUTER_MODEL ?? 'UltimateAI',
  TIMEOUT_MS: parseNumber(process.env.NINE_ROUTER_TIMEOUT_MS, 120000),
  RETRY_ATTEMPTS: parseNumber(process.env.NINE_ROUTER_RETRY_ATTEMPTS, 3),
  RETRY_DELAY_MS: parseNumber(process.env.NINE_ROUTER_DELAY_MS, 1000),
};
