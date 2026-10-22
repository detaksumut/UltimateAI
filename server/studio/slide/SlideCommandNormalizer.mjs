/**
 * SlideCommandNormalizer.mjs
 * Resolves explicit or contextual slide generation/revision commands.
 */
export class SlideCommandNormalizer {
  normalize(input = '', session = null) {
    const text = String(input || '').trim();
    const lower = text.toLowerCase();
    const imageOnly = /\b(?:buat|buatkan|bikin|generate)\s+(?:gambar|foto|ilustrasi)\b/i.test(text)
      && !/\b(?:slide|presentasi|deck|pptx?|powerpoint)\b/i.test(text);
    if (imageOnly) return { matched: false, reason: 'standalone-image-request' };

    const numberMatch = text.match(/\bslide\s*(\d{1,2})\b/i)
      || text.match(/\b(?:revisi|ulang|ganti\s+visual)\s+slide\s*(\d{1,2})\b/i);
    const currentSlide = Number(session?.currentSlide || session?.slides?.current || 1);
    const contextual = !numberMatch && /\b(?:buat\s+visualnya|visualnya|lanjut\s+visual|render\s+slide\s+ini)\b/i.test(lower);
    const explicitStyle = lower.match(/\b(?:gaya|style)\s+([a-z0-9-]+)\b/i);
    const style = explicitStyle?.[1] || undefined;
    const isRevision = /\b(?:revisi|ulang|ganti\s+visual|perbaiki\s+visual)\b/i.test(lower);

    if (!numberMatch && !contextual) {
      return { matched: false, reason: 'no-slide-target' };
    }

    return {
      matched: true,
      target: numberMatch ? Number(numberMatch[1]) : currentSlide,
      operation: isRevision ? 'REVISION' : 'GENERATION',
      style,
      isContextual: contextual,
      bypassImageGeneration: true,
      originalInput: text
    };
  }
}
export const slideCommandNormalizerInstance = new SlideCommandNormalizer();
export default slideCommandNormalizerInstance;
