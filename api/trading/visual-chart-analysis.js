// Dedicated Gemini vision endpoint for JIN chart screenshot extraction.
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};
function collectGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY?.trim()) keys.push(process.env.GEMINI_API_KEY.trim());
  for (let i = 1; i <= 15; i++) {
    const key = process.env['GEMINI_API_KEY_' + i];
    if (key?.trim()) keys.push(key.trim());
  }
  return [...new Set(keys)];
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed. Use POST.' });
  try {
    const instrument = String(req.body?.instrument || 'XAUUSD').slice(0, 30);
    const timeframe = String(req.body?.timeframe || '').toUpperCase().slice(0, 10);
    const image = String(req.body?.image || '');
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return send(res, 400, { success: false, error: 'Screenshot tidak valid. Kirim data URL JPEG, PNG, atau WebP.' });
    if (match[2].length > 8_000_000) return send(res, 413, { success: false, error: 'Screenshot terlalu besar. Batas payload gambar sekitar 6 MB.' });
    const keys = collectGeminiKeys();
    if (!keys.length) return send(res, 503, { success: false, error: 'GEMINI_API_KEY belum disetel pada environment LIVE (Vercel). Tambahkan key pada Production lalu redeploy.' });
    const prompt = 'Extract only what is visibly supported by this trading-chart screenshot. UI instrument requested: ' + instrument + '. Requested timeframe: ' + timeframe + '. Read the chart\'s own displayed symbol and timeframe; do not assume them from the request. Do not infer exact OHLC prices from candle pixels. Return one JSON object only with this schema: {"instrument":"string","timeframe":"string","symbol_match":true,"timeframe_match":true,"visible_candles":0,"ohlc_readable":false,"last_price":null,"open":null,"high":null,"low":null,"close":null,"trend":"BULLISH|BEARISH|SIDEWAYS|UNKNOWN","momentum":"BULLISH|BEARISH|NEUTRAL|UNKNOWN","support":null,"resistance":null,"volatility":"LOW|NORMAL|HIGH|UNKNOWN","scenario":"BUY_BIAS|SELL_BIAS|WAIT","confidence":0,"data_quality":"GOOD|PARTIAL|POOR","note":"short reason"}. Numeric prices must be numbers or null. If chart symbol/timeframe is not legible, use an empty string and PARTIAL or POOR. If screenshot is not a chart or shows recursive screen-sharing, use POOR and WAIT. Never fabricate prices.';
    // gemini-3.8-flash dikeluarkan dari rotation: secara konsisten 503/timeout (30s+) dan menyebabkan batch melebihi client timeout 60s.
    const VERIFIED_VISION_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];
    const RETIRED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']);

    let configuredModel = String(process.env.GEMINI_VISION_MODEL || '').trim();
    if (!configuredModel || RETIRED_MODELS.has(configuredModel) || RETIRED_MODELS.has(configuredModel.replace(/^models\//, ''))) {
      configuredModel = 'gemini-3.6-flash';
    }
    const candidateModels = [...new Set([configuredModel, ...VERIFIED_VISION_MODELS])].filter(m => !RETIRED_MODELS.has(m));

    let lastError = 'Gemini vision request failed.';
    let allKeysAuthDenied = true;

    for (const key of keys) {
      let keyAuthFailed = false;

      for (const model of candidateModels) {
        try {
          const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [
                { text: prompt },
                { inline_data: { mime_type: match[1], data: match[2] } }
              ] }],
              generationConfig: {
                temperature: 0,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    instrument: { type: 'STRING' }, timeframe: { type: 'STRING' },
                    symbol_match: { type: 'BOOLEAN' }, timeframe_match: { type: 'BOOLEAN' },
                    visible_candles: { type: 'INTEGER' }, ohlc_readable: { type: 'BOOLEAN' },
                    last_price: { type: 'NUMBER', nullable: true }, open: { type: 'NUMBER', nullable: true },
                    high: { type: 'NUMBER', nullable: true }, low: { type: 'NUMBER', nullable: true },
                    close: { type: 'NUMBER', nullable: true }, trend: { type: 'STRING' },
                    momentum: { type: 'STRING' }, support: { type: 'NUMBER', nullable: true },
                    resistance: { type: 'NUMBER', nullable: true }, volatility: { type: 'STRING' },
                    scenario: { type: 'STRING' }, confidence: { type: 'NUMBER' },
                    data_quality: { type: 'STRING' }, note: { type: 'STRING' }
                  },
                  required: ['instrument','timeframe','symbol_match','timeframe_match','visible_candles','ohlc_readable','last_price','open','high','low','close','trend','momentum','support','resistance','volatility','scenario','confidence','data_quality','note']
                }
              }
            }),
            // 20s per-model timeout: dengan 3 kandidat model × N kunci, total latency tetap
            // di bawah 60s client timeout di VisualChartCapturePanel.
            signal: AbortSignal.timeout(20000)
          });

          if (!response.ok) {
            const detail = (await response.text()).slice(0, 300).replace(/AIzaSy[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
            lastError = `Gemini Vision HTTP ${response.status} (${model}): ${detail}`;

            // 1. Error autentikasi / izin project (401 / 403):
            // Bukan masalah model. Jangan buang waktu merotasi model pada key yang sama; pindah ke key berikutnya.
            if (response.status === 401 || response.status === 403) {
              keyAuthFailed = true;
              break;
            }

            // 2. Model tidak ditemukan / dipensiunkan Google (404):
            // Rotasi ke model kandidat vision berikutnya.
            if (response.status === 404) {
              allKeysAuthDenied = false;
              continue;
            }

            // 3. Kuota habis / Rate limit (429):
            // Pindah ke key berikutnya dalam pool.
            if (response.status === 429) {
              allKeysAuthDenied = false;
              break;
            }

            // 4. Server overload / lonjakan permintaan (5xx):
            // Coba model kandidat lain yang mungkin tidak mengalami lonjakan.
            if (response.status >= 500) {
              allKeysAuthDenied = false;
              continue;
            }

            // Error client lainnya (misal 400 Bad Request)
            allKeysAuthDenied = false;
            return send(res, 502, { success: false, error: lastError });
          }

          allKeysAuthDenied = false;
          const result = await response.json();
          const raw = (result.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
          let data;
          try { data = JSON.parse(raw); }
          catch {
            lastError = `Gemini Vision (${model}) tidak mengembalikan JSON valid.`;
            continue;
          }
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            lastError = `Gemini Vision (${model}) response is not a JSON object.`;
            continue;
          }
          return send(res, 200, { success: true, provider: 'GEMINI_VISION', model, data });
        } catch (error) {
          allKeysAuthDenied = false;
          lastError = error?.name === 'TimeoutError'
            ? `Gemini Vision (${model}) timeout setelah 45s.`
            : (error?.message || 'Gemini Vision request failed.');
        }
      }

      if (!keyAuthFailed) {
        allKeysAuthDenied = false;
      }
    }

    if (allKeysAuthDenied) {
      return send(res, 403, {
        success: false,
        error: 'Akses API Gemini ditolak (HTTP 401/403). Semua key yang dikonfigurasi tidak memiliki izin atau kuota project tidak aktif. Periksa GEMINI_API_KEY di dashboard Vercel / GCP.'
      });
    }

    return send(res, 502, { success: false, error: lastError });
  } catch (error) {
    return send(res, 500, { success: false, error: error?.message || 'Visual chart analysis failed.' });
  }
}

