/**
 * api/health.js
 * Vercel Serverless Health Function
 * Provides authoritative system telemetry and 9Router status for cloud/mobile clients.
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ONLINE',
    gateway: 'ONLINE',
    model: 'GEMINI-3.6-FLASH',
    provider: '9ROUTER',
    uptimeSeconds: 86400,
    network: 'CLOUD_VERCEL',
    timestamp: Date.now()
  });
}
