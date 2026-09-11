/**
 * PresentationGenerator.mjs
 * Two-phase presentation workflow for JIN.
 * 
 * Phase 1: DRAFT - Generate outline with slide titles and bullet points
 * Phase 2: VISUAL - Generate visual image for each slide step by step
 */

import { imageGenerationInstance } from './ImageGeneration.mjs';

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
   * Phase 1: Generate draft outline
   */
  generateDraft(presentationIntent, sessionId) {
    const session = this.getSession(sessionId);
    const { topic, slideCount, speakerName, speakerPhoto } = presentationIntent;

    session.topic = topic;
    session.slideCount = slideCount || 10;
    session.speakerName = speakerName || null;
    session.speakerPhoto = speakerPhoto || null;
    session.phase = 'DRAFT';

    // Generate slide outline
    const slides = [];
    
    // Slide 1: Title slide
    slides.push({
      number: 1,
      title: topic,
      type: 'TITLE',
      bullets: [],
      speakerName: speakerName,
      speakerPhoto: speakerPhoto,
      visualPrompt: `Professional presentation title slide with "${topic}" as main title${speakerName ? `, speaker ${speakerName}` : ''}, corporate enterprise style, clean modern design, navy blue and gold accent colors`
    });

    // Slide 2: Table of Contents / Daftar Isi
    slides.push({
      number: 2,
      title: 'Daftar Isi',
      type: 'TOC',
      bullets: this._generateTOCBullets(topic, slideCount),
      visualPrompt: `Professional table of contents slide for presentation about "${topic}", clean layout with numbered items, corporate style`
    });

    // Middle slides: Content slides
    const contentSlidesCount = slideCount - 4; // Minus title, TOC, conclusion, thank you
    for (let i = 0; i < contentSlidesCount; i++) {
      const slideNumber = i + 3;
      const slideTitle = this._generateSlideTitle(topic, i, contentSlidesCount);
      slides.push({
        number: slideNumber,
        title: slideTitle,
        type: 'CONTENT',
        bullets: this._generateSlideBullets(topic, slideTitle, i),
        visualPrompt: `Professional presentation slide about "${slideTitle}" in context of "${topic}", corporate enterprise style, clean modern design with visual elements`
      });
    }

    // Second to last: Conclusion
    slides.push({
      number: slideCount - 1,
      title: 'Kesimpulan',
      type: 'CONCLUSION',
      bullets: this._generateConclusionBullets(topic),
      visualPrompt: `Professional conclusion slide summarizing key points about "${topic}", corporate style, clean summary layout`
    });

    // Last slide: Thank You
    slides.push({
      number: slideCount,
      title: 'Terima Kasih',
      type: 'THANK_YOU',
      bullets: speakerName ? [`${speakerName}`] : [],
      visualPrompt: `Professional thank you slide${speakerName ? ` for ${speakerName}` : ''}, corporate enterprise style, elegant closing design`
    });

    session.slides = slides;
    session.phase = 'DRAFT';

    return {
      success: true,
      session,
      draft: this._formatDraft(slides, topic, speakerName)
    };
  }

  /**
   * Phase 2: Generate visual for specific slide
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

    try {
      const result = await imageGenerationInstance.generateImage({
        prompt: slide.visualPrompt,
        size: '1024x576', // 16:9 landscape for slides
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
      slide.visualPrompt = `Professional presentation slide about "${slide.title}" in context of "${session.topic}", corporate enterprise style, clean modern design`;
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

  // Helper methods for generating slide content

  _generateTOCBullets(topic, slideCount) {
    const bullets = [];
    const contentSlidesCount = slideCount - 4;
    
    for (let i = 0; i < contentSlidesCount; i++) {
      bullets.push(`${i + 3}. ${this._generateSlideTitle(topic, i, contentSlidesCount)}`);
    }
    
    return bullets;
  }

  _generateSlideTitle(topic, index, totalSlides) {
    // Generate contextual slide titles based on topic
    const titleTemplates = [
      'Pengertian dan Definisi',
      'Latar Belakang',
      'Tujuan dan Sasaran',
      'Manfaat dan Keunggulan',
      'Tantangan dan Hambatan',
      'Strategi Implementasi',
      'Studi Kasus',
      'Analisis Dampak',
      'Rekomendasi',
      'Langkah Selanjutnya'
    ];
    
    return titleTemplates[index % titleTemplates.length];
  }

  _generateSlideBullets(topic, slideTitle, index) {
    // Generate placeholder bullets
    return [
      `Poin utama ${slideTitle}`,
      `Detail dan penjelasan`,
      `Contoh penerapan`,
      `Rekomendasi`
    ];
  }

  _generateConclusionBullets(topic) {
    return [
      'Rangkuman poin-poin utama',
      'Temuan penting',
      'Rekomendasi akhir',
      'Penutup'
    ];
  }

  _formatDraft(slides, topic, speakerName) {
    let draft = `📋 DRAFT PRESENTASI\n`;
    draft += `Topik: ${topic}\n`;
    draft += `Jumlah Slide: ${slides.length}\n`;
    if (speakerName) draft += `Pembicara: ${speakerName}\n`;
    draft += `\n${'═'.repeat(50)}\n\n`;

    for (const slide of slides) {
      draft += `SLIDE ${slide.number}: ${slide.title}\n`;
      draft += `Tipe: ${slide.type}\n`;
      if (slide.bullets.length > 0) {
        draft += `Poin-poin:\n`;
        for (const bullet of slide.bullets) {
          draft += `  • ${bullet}\n`;
        }
      }
      if (slide.speakerName) {
        draft += `Pembicara: ${slide.speakerName}\n`;
      }
      draft += `\n`;
    }

    draft += `${'═'.repeat(50)}\n`;
    draft += `✅ Draft selesai. Konfirmasi untuk lanjut ke pembuatan visual.\n`;
    draft += `Ketik "lanjut" untuk mulai generate visual, atau "ubah [slide] [perubahan]" untuk edit.`;

    return draft;
  }
}

// Singleton instance
export const presentationGeneratorInstance = new PresentationGenerator();
