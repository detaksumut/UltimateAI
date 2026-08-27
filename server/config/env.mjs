/**
 * env.mjs
 * Server-Side Environment Configuration and Secret Vault.
 * Auto-loads .env file if present on disk.
 */

import fs from 'fs';
import path from 'path';

// Auto-load .env file if exists
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
} catch {}

export const config = {
  port: parseInt(process.env.PORT || '20128', 10),
  defaultProvider: process.env.DEFAULT_PROVIDER || 'gemini',
  keys: {
    gemini: process.env.GEMINI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    claude: process.env.ANTHROPIC_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || ''
  },
  endpoints: {
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    deepseek: 'https://api.deepseek.com/v1'
  }
};

export function getProviderConfigStatus() {
  return {
    gemini: {
      configured: Boolean(config.keys.gemini && config.keys.gemini.trim().length > 10),
      model: 'gemini-2.0-flash'
    },
    openai: {
      configured: Boolean(config.keys.openai && config.keys.openai.trim().length > 10),
      model: 'gpt-4o-mini'
    },
    claude: {
      configured: Boolean(config.keys.claude && config.keys.claude.trim().length > 10),
      model: 'claude-3-5-sonnet-20241022'
    },
    deepseek: {
      configured: Boolean(config.keys.deepseek && config.keys.deepseek.trim().length > 10),
      model: 'deepseek-reasoner'
    }
  };
}

export default config;
