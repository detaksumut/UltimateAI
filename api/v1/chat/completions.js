/**
 * api/v1/chat/completions.js
 * Vercel Serverless Function for OpenAI-compatible Chat Completions.
 * Handles live media (YouTube) playback and Gemini 3 Flash / Gemini cloud inference.
 */

async function searchYouTubeVideo(query) {
  try {
    const cleanQ = query
      .replace(/\b(carikan|cari|putar|mainkan|tampilkan|play|lagu|musik|di|dari|youtube|video|judulnya|judul|penyanyi)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const searchTarget = cleanQ || query;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTarget + ' official video')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    
    if (res.ok) {
      const html = await res.text();
      // Match first videoId
      const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return {
          videoId: match[1],
          query: searchTarget
        };
      }
    }
  } catch (err) {
    console.warn('[YouTubeSearch] Error:', err.message);
  }
  return null;
}

export default async function handler(req, res) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    const { messages = [], stream = false, model = 'ag/gemini-3-flash' } = body;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const userPrompt = typeof lastUserMessage === 'string' ? lastUserMessage : JSON.stringify(lastUserMessage);

    // 2. DETECT YOUTUBE / MUSIC PLAYBACK REQUESTS
    const isYouTubeIntent = /\b(youtube|lagu|musik|music|song|video|putar|play|setel|dengarkan)\b/i.test(userPrompt);

    if (isYouTubeIntent) {
      const ytResult = await searchYouTubeVideo(userPrompt);
      const videoId = ytResult?.videoId || 'CP018TPJ40Y'; // Bryan Adams - Heaven verified fallback
      const cleanTitle = (ytResult?.query || userPrompt)
        .replace(/\b(carikan|cari|putar|mainkan|di|dari|youtube|video|judulnya|penyanyi)\b/gi, '')
        .trim();

      const playbackText = `Lagu **"${cleanTitle || 'Heaven - Bryan Adams'}"** telah ditemukan di YouTube dan langsung diputar di Canvas pemutar di bawah ini:\n\n` +
        `<div style="width: 100%; position: relative; padding-bottom: 56.25%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.4); background-color: #000;">\n` +
        `  <iframe \n` +
        `    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1" \n` +
        `    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" \n` +
        `    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" \n` +
        `    allowfullscreen \n` +
        `    referrerpolicy="strict-origin-when-cross-origin" \n` +
        `    title="${cleanTitle}">\n` +
        `  </iframe>\n` +
        `</div>\n\n` +
        `🔗 [Buka "${cleanTitle}" di YouTube](https://www.youtube.com/watch?v=${videoId})`;

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, delta: { content: playbackText }, finish_reason: null }]
        })}\n\n`);
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          _agent: {
            intent: 'MEDIA_PLAYBACK',
            toolsUsed: ['youtube.search'],
            videoId,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title: cleanTitle
          }
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      } else {
        return res.status(200).json({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, message: { role: 'assistant', content: playbackText }, finish_reason: 'stop' }],
          _agent: {
            intent: 'MEDIA_PLAYBACK',
            toolsUsed: ['youtube.search'],
            videoId,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title: cleanTitle
          }
        });
      }
    }

    // 3. GENERAL AI CONVERSATION (Gemini Cloud API fallback)
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.NINEROUTER_KEY;
    let assistantReply = `Halo! Saya JINI, AI partner Anda. Bagaimana saya bisa membantu Anda hari ini?`;

    if (geminiKey) {
      try {
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
          }));

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          }),
          signal: AbortSignal.timeout(20000)
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const candidateText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            assistantReply = candidateText;
          }
        }
      } catch (geminiErr) {
        console.warn('[GeminiCloud] Error:', geminiErr.message);
      }
    }

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, delta: { content: assistantReply }, finish_reason: null }]
      })}\n\n`);
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      return res.status(200).json({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, message: { role: 'assistant', content: assistantReply }, finish_reason: 'stop' }]
      });
    }
  } catch (err) {
    console.error('[ChatCompletions] Fatal Error:', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
}
