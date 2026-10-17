/**
 * youtubeCardHelpers.mjs
 * Deteksi video YouTube di HTML dan pembersihan tag <iframe> mentah agar
 * tidak disuntik melalui dangerouslySetInnerHTML (browser tidak memuat
 * iframe dari innerHTML → area hitam).
 */

// Ekstrak videoId YouTube dari berbagai format URL/embed.
export function extractYouTubeVideoId(htmlContent = '') {
  const match = String(htmlContent || '').match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

// Buang tag <iframe> mentah dari HTML yang akan disuntik via innerHTML.
// Harus di-render melalui komponen React asli (YouTubeNativeEmbed).
export function sanitizeYouTubeHtml(htmlContent = '') {
  return String(htmlContent || '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
}
