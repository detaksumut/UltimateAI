/**
 * VoiceService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Voice Domain Service
 *
 * Handles voice processing:
 *   - Speech-to-Text (STT) transcription
 *   - Text-to-Speech (TTS) synthesis
 *   - Voice command parsing
 *   - Multi-language support
 *
 * Task Types:
 *   STT      → Speech-to-Text transcription
 *   TTS      → Text-to-Speech synthesis
 *   PARSE    → Parse voice commands
 * ═══════════════════════════════════════════════════════════════════════
 */

class VoiceService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.language = options.language || 'id-ID';
    this.voice = options.voice || 'default';
  }

  /**
   * Generate artifact for a voice task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'STT':
        return await this._stt(task, context);
      case 'TTS':
        return await this._tts(task, context);
      case 'PARSE':
        return await this._parse(task, context);
      default:
        return await this._parse(task, context);
    }
  }

  /**
   * Verify artifact
   */
  async verify(artifact, context) {
    if (!artifact || !artifact.content) {
      return { valid: false, reason: 'Empty artifact' };
    }
    return { valid: true };
  }

  /**
   * Display artifact
   */
  async display(artifact, context) {}

  /**
   * Commit artifact
   */
  async commit(artifact, context) {}

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * STT: Speech-to-Text transcription
   */
  async _stt(task, context) {
    const audioData = this._getAudioData(task, context);

    if (this.llmClient) {
      return await this._sttWithLLM(audioData, task);
    }

    return this._sttWithoutLLM(audioData, task);
  }

  /**
   * TTS: Text-to-Speech synthesis
   */
  async _tts(task, context) {
    const text = this._getText(task, context);

    if (this.llmClient) {
      return await this._ttsWithLLM(text, task);
    }

    return this._ttsWithoutLLM(text, task);
  }

  /**
   * PARSE: Parse voice commands
   */
  async _parse(task, context) {
    const transcript = this._getTranscript(task, context);

    if (this.llmClient) {
      return await this._parseWithLLM(transcript, task);
    }

    return this._parseWithoutLLM(transcript, task);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED PROCESSING
  // ═══════════════════════════════════════════════════════════════════════

  async _sttWithLLM(audioData, task) {
    const prompt = `Transkripsi audio berikut:\n\n${audioData?.slice(0, 2000) || 'Data audio tidak tersedia'}\n\nBuat transkripsi yang akurat dalam bahasa ${this.language}.`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: `Kamu adalah transkripter audio. Transkripsi dengan akurat dalam bahasa ${this.language}.` },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.1,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'TEXT',
      content: text,
      metadata: { taskId: task.id, phase: 'STT', language: this.language, model: this.llmModel },
    };
  }

  async _ttsWithLLM(text, task) {
    const prompt = `Buat representasi audio untuk teks berikut:\n\n"${text?.slice(0, 1000) || ''}"\n\nBuat SSML atau deskripsi prosodi.`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah spesialis TTS. Buat representasi audio yang natural.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const result = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'AUDIO_META',
      content: result,
      metadata: { taskId: task.id, phase: 'TTS', voice: this.voice, model: this.llmModel },
    };
  }

  async _parseWithLLM(transcript, task) {
    const prompt = `Parse perintah suara berikut:\n\n"${transcript?.slice(0, 2000) || ''}"\n\nEkstrak:\n1. Intent (tujuan)\n2. Entities (entitas)\n3. Parameters (parameter)\n4. Confidence (keyakinan)`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah NLU parser. Parse perintah suara dengan akurat.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.2,
      stream: false,
    });

    const result = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'JSON',
      content: result,
      metadata: { taskId: task.id, phase: 'PARSE', model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC GENERATION (NO LLM)
  // ═══════════════════════════════════════════════════════════════════════

  _sttWithoutLLM(audioData, task) {
    return {
      type: 'TEXT',
      content: `[Transkripsi]\n\nAudio: ${audioData || 'Data audio tidak tersedia'}\n\nStatus: Memerlukan layanan STT untuk transkripsi akurat.\nBatasan: Tanpa LLM, hanya menyediakan placeholder transkripsi.`,
      metadata: { taskId: task.id, phase: 'STT', language: this.language, mode: 'PLACEHOLDER' },
    };
  }

  _ttsWithoutLLM(text, task) {
    return {
      type: 'AUDIO_META',
      content: `## Representasi Audio\n\n**Teks:** ${text || ''}\n\n**Prosodi:**\n- Tempo: Normal\n- Nada: Sedang\n- Volume: Normal\n\n**SSML:**\n<speak>\n  <prosody rate="medium" pitch="medium">\n    ${text || ''}\n  </prosody>\n</speak>\n\nStatus: Memerlukan layanan TTS untuk sintesis audio.`,
      metadata: { taskId: task.id, phase: 'TTS', voice: this.voice, mode: 'SSML' },
    };
  }

  _parseWithoutLLM(transcript, task) {
    const words = (transcript || '').toLowerCase().split(/\s+/);

    let intent = 'UNKNOWN';
    let entities = [];

    // Simple keyword matching
    if (words.includes('cari') || words.includes('search') || words.includes('find')) {
      intent = 'SEARCH';
    } else if (words.includes('buka') || words.includes('open') || words.includes('launch')) {
      intent = 'OPEN';
    } else if (words.includes('tutup') || words.includes('close') || words.includes('stop')) {
      intent = 'CLOSE';
    } else if (words.includes('jalankan') || words.includes('run') || words.includes('execute')) {
      intent = 'EXECUTE';
    } else if (words.includes('buat') || words.includes('create') || words.includes('new')) {
      intent = 'CREATE';
    } else if (words.includes('hapus') || words.includes('delete') || words.includes('remove')) {
      intent = 'DELETE';
    } else if (words.includes('update') || words.includes('ubah') || words.includes('change')) {
      intent = 'UPDATE';
    }

    // Extract potential entities (words that might be targets)
    const actionWords = ['cari', 'search', 'find', 'buka', 'open', 'launch', 'tutup', 'close', 'stop',
      'jalankan', 'run', 'execute', 'buat', 'create', 'new', 'hapus', 'delete', 'remove',
      'update', 'ubah', 'change'];
    entities = words.filter(w => !actionWords.includes(w) && w.length > 2);

    return {
      type: 'JSON',
      content: JSON.stringify({
        transcript: transcript || '',
        intent,
        entities: entities.slice(0, 5),
        confidence: transcript ? 0.7 : 0.0,
        language: this.language,
      }, null, 2),
      metadata: { taskId: task.id, phase: 'PARSE', mode: 'KEYWORD_MATCH' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _getAudioData(task, context) {
    if (task.input) return task.input;
    if (task.description) return task.description;
    return context?.session?.objective || null;
  }

  _getText(task, context) {
    if (task.input) return task.input;
    // Check for previous STT artifact
    if (context?.session?.artifacts && context?.session?.tasks) {
      const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
      for (let i = taskIdx - 1; i >= 0; i--) {
        const prevTask = context.session.tasks[i];
        const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
        if (artifact && artifact.type === 'TEXT') return artifact.content;
      }
    }
    return context?.session?.objective || '';
  }

  _getTranscript(task, context) {
    if (task.input) return task.input;
    // Check for previous STT artifact
    if (context?.session?.artifacts && context?.session?.tasks) {
      const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
      for (let i = taskIdx - 1; i >= 0; i--) {
        const prevTask = context.session.tasks[i];
        const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
        if (artifact && artifact.metadata?.phase === 'STT') return artifact.content;
      }
    }
    return context?.session?.objective || '';
  }
}

export { VoiceService };
export default VoiceService;
