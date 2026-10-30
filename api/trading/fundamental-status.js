// Vercel serverless status endpoint. The local scheduler does not run in Vercel,
// so report an explicit empty schedule state and let the client perform a live read.
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  return res.status(200).json({
    success: true,
    schedulerAvailable: false,
    lastRun: null,
    message: 'Scheduled gold-news reader is not running in this serverless deployment; use live read.'
  });
}
