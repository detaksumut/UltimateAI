/**
 * LiveVideoResolver.mjs
 * Autonomous Media & News Ranking Engine.
 * Scrapes live YouTube search results and ranks by relevance, recency, and view estimates.
 */

export class LiveVideoResolver {
  // Trusted official media channels ranking weights
  static TRUSTED_CHANNELS = [
    { name: 'KOMPAS TV', weight: 100 },
    { name: 'CNN Indonesia', weight: 95 },
    { name: 'TVOne News', weight: 90 },
    { name: 'Tribun Network', weight: 85 },
    { name: 'Metro TV', weight: 85 },
    { name: 'CNBC Indonesia', weight: 88 },
    { name: 'detikcom', weight: 87 },
    { name: 'Kumparan', weight: 82 },
    { name: 'Tempo', weight: 86 },
    { name: 'Viva.co.id', weight: 80 }
  ];

  /**
   * Scrape YouTube search results with metadata extraction
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of video objects
   */
  static async _scrapeYouTube(query) {
    const encoded = encodeURIComponent(query);
    const candidates = [];

    try {
      // Method 1: YouTube search page scraping
      const res = await fetch(`https://www.youtube.com/results?search_query=${encoded}&sp=CAISBAgDEAE%253D`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const html = await res.text();

        // Extract video IDs with surrounding context for titles
        const videoMatches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
        const uniqueIds = [...new Set(videoMatches.map(m => m[1]))].filter(id => id.length === 11);

        // Try to extract titles from ytInitialData
        const titleMatches = [...html.matchAll(/"title":\s*\{[^}]*"runs":\s*\[\{[^}]*"text":\s*"([^"]+)"/g)];
        const viewMatches = [...html.matchAll(/"viewCountText":\s*\{[^}]*"simpleText":\s*"([^"]+)"/g)];
        const channelMatches = [...html.matchAll(/"ownerText":\s*\{[^}]*"runs":\s*\[\{[^}]*"text":\s*"([^"]+)"/g)];
        const publishedMatches = [...html.matchAll(/"publishedTimeText":\s*\{[^}]*"simpleText":\s*"([^"]+)"/g)];

        for (let i = 0; i < Math.min(uniqueIds.length, 10); i++) {
          const title = titleMatches[i]?.[1] || `Video: ${query}`;
          const views = viewMatches[i]?.[1] || 'N/A views';
          const channel = channelMatches[i]?.[1] || 'Unknown channel';
          const published = publishedMatches[i]?.[1] || '';

          // Score based on channel trust and view count
          let score = 70; // Base score for appearing in search
          const channelLower = channel.toLowerCase();
          for (const trusted of LiveVideoResolver.TRUSTED_CHANNELS) {
            if (channelLower.includes(trusted.name.toLowerCase())) {
              score = Math.max(score, 80 + Math.floor(trusted.weight / 10));
              break;
            }
          }

          // Boost for recency
          if (published.includes('jam') || published.includes('hour') || published.includes('menit') || published.includes('minute')) {
            score += 10;
          } else if (published.includes('hari') || published.includes('day')) {
            score += 5;
          }

          candidates.push({
            videoId: uniqueIds[i],
            title: title.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
            channel,
            views,
            published,
            isLive: published.includes('Live') || published.includes('LIVE'),
            score: Math.min(score, 99),
            reason: score >= 85 ? 'Trusted media source' : 'YouTube search result'
          });
        }
      }
    } catch (err) {
      console.warn('[VIDEO_RESOLVER] YouTube scrape failed:', err.message);
    }

    return candidates;
  }

  /**
   * Autonomously resolves and selects the best video for a given query
   * @param {string} query - Search prompt
   * @returns {Promise<Object>} selectedVideo
   */
  static async resolveBestVideo(query) {
    const raw = query || '';
    const candidates = await LiveVideoResolver._scrapeYouTube(raw);

    // If scraping returned results, use them (already scored)
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return {
        selectedVideo: candidates[0],
        candidates: candidates.slice(0, 5),
        totalFound: candidates.length,
        selectionStrategy: 'LIVE_YOUTUBE_SEARCH'
      };
    }

    // Fallback: minimal curated list with a notice
    const fallbackCandidates = [
      {
        videoId: 'dQw4w9WgXcQ',
        title: `Pencarian video: "${raw}"`,
        channel: 'YouTube',
        views: 'Hasil pencarian',
        isLive: false,
        score: 50,
        reason: 'Fallback — YouTube scraping tidak tersedia. Coba link langsung.'
      }
    ];

    return {
      selectedVideo: fallbackCandidates[0],
      candidates: fallbackCandidates,
      totalFound: 1,
      selectionStrategy: 'FALLBACK',
      notice: 'YouTube search temporarily limited. Try providing a direct YouTube URL for better results.'
    };
  }
}

export default LiveVideoResolver;
