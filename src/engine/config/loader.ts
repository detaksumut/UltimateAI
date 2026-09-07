// src/engine/config/loader.ts
// Loads environment variables and provides a strongly typed Config object with defaults.

import * as dotenv from 'dotenv';
dotenv.config();

export interface Config {
  AI_PROVIDER: string;
  TIMEOUT_MS: number;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY_MS: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

export const config: Config = {
  AI_PROVIDER: process.env.AI_PROVIDER ?? 'local_router',
  TIMEOUT_MS: parseNumber(process.env.TIMEOUT_MS, 120000),
  RETRY_ATTEMPTS: parseNumber(process.env.RETRY_ATTEMPTS, 3),
  RETRY_DELAY_MS: parseNumber(process.env.RETRY_DELAY_MS, 1000),
};
