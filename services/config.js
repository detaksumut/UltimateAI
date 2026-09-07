// services/config.js
// Centralised configuration for AI integration

require('dotenv').config();

module.exports = {
  TIMEOUT_MS: parseInt(process.env.TIMEOUT_MS, 10) || 120000,
  RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS, 10) || 3,
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS, 10) || 1000,
};
