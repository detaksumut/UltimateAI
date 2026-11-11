// Vercel serverless reader for allowlisted official macroeconomic sources.
import { officialSources, readOfficialSources } from '../../server/market/OfficialMacroReader.mjs';

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed. Use POST.' });
  try {
    const requested = Array.isArray(req.body?.sources) ? req.body.sources : Object.keys(officialSources());
    const sources = await readOfficialSources(requested);
    const readable = sources.some(source => source.status === 'READ');
    return send(res, 200, {
      success: true,
      fetchedAt: new Date().toISOString(),
      sources,
      ...(readable ? {} : { warning: 'No allowlisted official source could be read by the deployment.' })
    });
  } catch (error) {
    return send(res, 500, { success: false, error: error?.message || 'Fundamental source read failed' });
  }
}
