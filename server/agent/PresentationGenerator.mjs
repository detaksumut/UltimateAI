/**
 * PresentationGenerator.mjs
 * Two-phase presentation workflow for JIN.
 * 
 * Phase 1: DRAFT - LLM generates contextual slide titles based on topic
 * Phase 2: VISUAL - Pollinations generates background per slide
 */

import { imageGenerationInstance } from './ImageGeneration.mjs';
import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';

export class PresentationGenerator {
  constructor() {
    this.sessions = new Map(); // sessionId -> presentation state
  }

  /**
   * Get or create presentation session
   */
  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        phase: 'DRAFT',
        topic: '',
        slideCount: 10,
        speakerName: null,
        speakerPhoto: null,
        slides: [],
        currentSlideIndex: 0,
        createdAt: Date.now()
      });
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Phase 1: Generate draft outline using LLM intelligence
   */
  async generateDraft(presentationIntent, sessionId) {
    const session = this.getSession(sessionId);
    const { topic, slideCount, speakerName, speakerPhoto } = presentationIntent;

    session.topic = topic;
    session.slideCount = slideCount || 10;
    session.speakerName = speakerName || null;
    session.speakerPhoto = speakerPhoto || null;
    session.phase = 'DRAFT';

    // Use LLM to generate contextual slides
    const slides = await this._generateSlidesWithLLM(topic, slideCount, speakerName, speakerPhoto);

    session.slides = slides;
    session.phase = 'DRAFT';

    return {
      success: true,
      session,
      draft: this._formatDraft(slides, topic, speakerName)
    };
  }

  /**
   * Use LLM to generate contextual slide titles based on topic
   */
  async _generateSlidesWithLLM(topic, slideCount, speakerName, speakerPhoto) {
    const prompt = `Kamu adalah ahli presentasi profesional. Buatlah daftar ${slideCount} slide presentasi untuk tema: "${topic}"

Format response (HANYA JSON, tanpa penjelasan tambahan):
{
  "slides": [
    {"title": "Judul Slide 1", "bullets": ["poin 1", "poin 2"]},
    {"title": "Judul Slide 2", "bullets": ["poin 1", "poin 2"]}
  ]
}

Aturan:
- Slide 1 adalah judul presentasi
- Slide terakhir adalah "Terima Kasih" atau "Penutup"
- Slide lainnya berisi konten EKSPLISIT dari tema (bukan template generik)
- Setiap slide punya 2-4 bullets yang relevan
- Bahasa Indonesia
- JANGAN gunakan "Daftar Isi" sebagai slide
- Fokus pada EKSPLASI tema, bukan struktur umum`;

    try {
      const response = await ollamaProviderInstance.sendChat([
        { role: 'user', content: prompt }
      ], { stream: false });

      const content = response?.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.slides && Array.isArray(parsed.slides)) {
          return parsed.slides.map((s, i) => ({
            number: i + 1,
            title: s.title,
            type: i === 0 ? 'TITLE' : (i === parsed.slides.length - 1 ? 'THANK_YOU' : 'CONTENT'),
            bullets: s.bullets || [],
            speakerName: i === 0 ? speakerName : null,
            speakerPhoto: i === 0 ? speakerPhoto : null
          }));
        }
      }
    } catch (err) {
      console.warn('[PresentationGenerator] LLM slide generation failed, using fallback:', err.message);
    }

    // Fallback: minimal contextual slides
    return this._generateFallbackSlides(topic, slideCount, speakerName, speakerPhoto);
  }

  /**
   * Fallback if LLM fails
   */
  _generateFallbackSlides(topic, slideCount, speakerName, speakerPhoto) {
    const slides = [];
    
    slides.push({
      number: 1,
      title: topic,
      type: 'TITLE',
      bullets: [],
      speakerName: speakerName,
      speakerPhoto: speakerPhoto
    });

    for (let i = 2; i < slideCount; i++) {
      slides.push({
        number: i,
        title: `Slide ${i}`,
        type: 'CONTENT',
        bullets: []
      });
    }

    slides.push({
      number: slideCount,
      title: 'Terima Kasih',
      type: 'THANK_YOU',
      bullets: [],
      speakerName: speakerName,
      speakerPhoto: speakerPhoto
    });

    return slides;
  }

  /**
   * Phase 2: Generate visual for specific slide - auto-generate from slide context
   */
  async generateSlideVisual(slideNumber, sessionId) {
    const session = this.getSession(sessionId);
    
    if (session.phase !== 'VISUAL' && session.phase !== 'DRAFT') {
      return { success: false, error: 'Invalid phase for visual generation' };
    }

    const slide = session.slides.find(s => s.number === slideNumber);
    if (!slide) {
      return { success: false, error: `Slide ${slideNumber} not found` };
    }

    session.phase = 'VISUAL';
    session.currentSlideIndex = slideNumber - 1;

    // Auto-build prompt from slide context
    const prompt = this._buildAutoPrompt(slide, session.topic);

    try {
      const result = await imageGenerationInstance.generateImage({
        prompt,
        size: '1024x576', // 16:9 landscape
        generationId: `presentation-${sessionId}`,
        messageId: `slide-${slideNumber}`
      });

      if (result.success && result.artifact) {
        slide.imageUrl = result.artifact.url;
        slide.generated = true;

        return {
          success: true,
          slide,
          artifact: result.artifact,
          nextSlide: slideNumber < session.slideCount ? slideNumber + 1 : null,
          isLast: slideNumber === session.slideCount
        };
      } else {
        return { success: false, error: result.error || 'Image generation failed' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Auto-build visual prompt - BACKGROUND ONLY, no text
   */
  _buildAutoPrompt(slide, topic) {
    const base = `Corporate enterprise background, landscape 16:9, professional business abstract, clean modern design, navy blue and white gradient, soft geometric shapes, subtle light rays, no text, no words, no letters, no numbers`;
    
    const typePart = slide.type === 'TITLE' ? 'elegant title slide background, centered focus area' :
                     slide.type === 'THANK_YOU' ? 'closing thank you background, warm gradient' :
                     'content slide background, balanced layout';

    return `${base}, ${typePart}`;
  }

  /**
   * Update slide content
   */
  updateSlide(slideNumber, updates, sessionId) {
    const session = this.getSession(sessionId);
    const slide = session.slides.find(s => s.number === slideNumber);
    
    if (!slide) {
      return { success: false, error: `Slide ${slideNumber} not found` };
    }

    Object.assign(slide, updates);
    
    // Regenerate visual prompt if content changed
    if (updates.title || updates.bullets) {
      slide.generated = false;
      slide.imageUrl = null;
    }

    return { success: true, slide };
  }

  /**
   * Get presentation status
   */
  getStatus(sessionId) {
    const session = this.getSession(sessionId);
    const generatedCount = session.slides.filter(s => s.generated).length;
    
    return {
      phase: session.phase,
      topic: session.topic,
      slideCount: session.slideCount,
      generatedCount,
      currentSlide: session.currentSlideIndex + 1,
      allGenerated: generatedCount === session.slideCount
    };
  }

  _formatDraft(slides, topic, speakerName) {
    let draft = `DRAFT PRESENTASI\n`;
    draft += `Topik: ${topic}\n`;
    draft += `Slide: ${slides.length}\n`;
    if (speakerName) draft += `Pembicara: ${speakerName}\n`;
    draft += `\n`;

    for (const slide of slides) {
      draft += `${slide.number}. ${slide.title}`;
      if (slide.type === 'CONTENT' && slide.bullets.length > 0) {
        draft += ` - ${slide.bullets[0]}`;
      }
      draft += `\n`;
    }

    draft += `\nKetik "slide 1" untuk mulai generate visual.`;

    return draft;
  }
}

// Singleton instance
export const presentationGeneratorInstance = new PresentationGenerator();
