/**
 * LiveConversationAnalyzer.mjs
 * Real-time semantic analyzer for streaming natural speech.
 * Continuously detects intent, extracts entities, and maintains conversational cognitive state.
 */

export class LiveConversationAnalyzer {
  /**
   * Analyze streaming transcript in real-time
   * @param {string} transcript - Full transcript accumulated so far
   * @param {Object} contextHistory - Previous conversational turns
   */
  static analyze(transcript, contextHistory = []) {
    if (!transcript || !transcript.trim()) {
      return {
        stage: 'STANDBY',
        intent: 'IDLE',
        conversationType: 'IDLE',
        actionRequired: false,
        topic: null,
        entities: {},
        cognitiveState: 'LISTENING'
      };
    }

    const raw = transcript.trim();
    const p = raw.toLowerCase();

    // 1. LIVE NEWS / BREAKING EVENT INTENT
    if (p.includes('berita') || p.includes('demo') || p.includes('dpr') || p.includes('politik') || p.includes('terkini') || p.includes('hari ini') || p.includes('peristiwa') || p.includes('kabinet')) {
      const cleanTopic = raw.replace(/^(hallo|halo|hai|ok|jin|tolong|coba|kamu|cari|carikan|pantau|lihat|di youtube|youtube|dari youtube)\s*/gi, '').trim();
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'LIVE_NEWS_RETRIEVAL',
        conversationType: 'ACTION_REQUIRED',
        actionRequired: true,
        recommendedTool: 'intel.multilayer_search',
        topic: cleanTopic || 'Berita Nasional Terkini',
        entities: { category: 'NEWS', platform: 'YOUTUBE_LIVE', query: cleanTopic },
        cognitiveState: 'PLANNING_NEWS_STREAM'
      };
    }

    // 2. MULTIMEDIA / MUSIC / VIDEO STREAM INTENT
    if (p.includes('lagu') || p.includes('dj') || p.includes('musik') || p.includes('music') || p.includes('song') || p.includes('remix') || p.includes('heaven') || p.includes('faded') || p.includes('video') || p.includes('putar') || p.includes('play')) {
      const cleanTrack = raw.replace(/^(hallo|halo|hai|ok|jin|tolong|coba|kamu|cari|carikan|putar|putarkan|play|dari youtube|youtube|lagsung play|langsung play)\s*/gi, '').trim();
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'MEDIA_PLAYBACK',
        conversationType: 'ACTION_REQUIRED',
        actionRequired: true,
        recommendedTool: 'media.stream_resolver',
        topic: cleanTrack || 'Musik Pilihan',
        entities: { category: 'MUSIC', platform: 'YOUTUBE', track: cleanTrack },
        cognitiveState: 'PLANNING_MEDIA_PLAYBACK'
      };
    }

    // 3. STRUCTURED DATA & ANALYTICS INTENT
    if (p.includes('data') || p.includes('tabel') || p.includes('grafik') || p.includes('chart') || p.includes('statistik') || p.includes('metrik') || p.includes('angka')) {
      const cleanTopic = raw.replace(/^(hallo|halo|hai|ok|jin|tolong|coba|tampilkan|sajikan|analisis|buatkan tabel)\s*/gi, '').trim();
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'DATA_EXTRACTION',
        conversationType: 'ACTION_REQUIRED',
        actionRequired: true,
        recommendedTool: 'data.matrix_generator',
        topic: cleanTopic || 'Matriks Data',
        entities: { category: 'DATA', query: cleanTopic },
        cognitiveState: 'PLANNING_DATA_MATRIX'
      };
    }

    // 4. APPLICATION & PROTOTYPE GENERATION INTENT
    if (p.includes('aplikasi') || p.includes('buat') || p.includes('kalkulator') || p.includes('prototype') || p.includes('app') || p.includes('build')) {
      const cleanApp = raw.replace(/^(hallo|halo|hai|ok|jin|tolong|coba|buatkan|bikin|generate)\s*/gi, '').trim();
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'APP_PROTOTYPE',
        conversationType: 'ACTION_REQUIRED',
        actionRequired: true,
        recommendedTool: 'app.generator',
        topic: cleanApp || 'Purwarupa Aplikasi',
        entities: { category: 'PROTOTYPE', concept: cleanApp },
        cognitiveState: 'PLANNING_APP_SANDBOX'
      };
    }

    // 5. CASUAL DISCUSSION & PHILOSOPHICAL / CONVERSATIONAL
    if (p.includes('halo') || p.includes('hai') || p.includes('salam') || p.includes('pendapatmu') || p.includes('menurutmu') || p.includes('bagaimana kabarmu')) {
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'GENERAL_DISCUSSION',
        conversationType: 'DISCUSSION',
        actionRequired: false,
        topic: 'Percakapan Alami',
        entities: {},
        cognitiveState: 'CONVERSING_NATURALLY'
      };
    }

    // 6. RESEARCH QUESTION
    if (p.includes('apa') || p.includes('siapa') || p.includes('mengapa') || p.includes('bagaimana') || p.includes('jelaskan') || p.includes('cari')) {
      return {
        stage: 'INTENT_CONFIRMED',
        intent: 'RESEARCH_SYNTHESIS',
        conversationType: 'QUESTION',
        actionRequired: true,
        recommendedTool: 'intel.multilayer_search',
        topic: raw,
        entities: { query: raw },
        cognitiveState: 'PLANNING_KNOWLEDGE_SEARCH'
      };
    }

    // Default In-Progress Intent Formulation
    return {
      stage: 'INTENT_FORMING',
      intent: 'CONTINUOUS_THOUGHT',
      conversationType: 'DISCUSSION',
      actionRequired: false,
      topic: raw,
      entities: {},
      cognitiveState: 'UNDERSTANDING_CONTEXT'
    };
  }
}

export default LiveConversationAnalyzer;
