// services/config.js
// Centralised configuration for 9Router integration

require('dotenv').config();

module.exports = {
  NINE_ROUTER_URL: process.env.NINE_ROUTER_URL,
  NINE_ROUTER_API_KEY: process.env.NINE_ROUTER_API_KEY,
  NINE_ROUTER_MODEL: process.env.NINE_ROUTER_MODEL || 'UltimateAI',
  // Defaults as specified by the user
  TIMEOUT_MS: parseInt(process.env.NINE_ROUTER_TIMEOUT_MS) || 120000,
  RETRY_ATTEMPTS: parseInt(process.env.NINE_ROUTER_RETRY_ATTEMPTS) || 3,
  RETRY_DELAY_MS: parseInt(process.env.NINE_ROUTER_DELAY_MS) || 1000,
};
