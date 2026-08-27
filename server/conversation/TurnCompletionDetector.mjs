/**
 * TurnCompletionDetector.mjs
 * Linguistic and semantic turn completion evaluator for natural conversation.
 * Determines if user is still speaking/formulating ideas or has completed their thought.
 */

export class TurnCompletionDetector {
  // Dangling conjunctions / unfinished sentence markers in Indonesian & English
  static UNFINISHED_ENDINGS = [
    'dan', 'atau', 'tapi', 'tetapi', 'karena', 'sebab', 'namun', 'sedangkan',
    'yang', 'untuk', 'agar', 'supaya', 'khususnya', 'seperti', 'yaitu', 'yakni',
    'tentang', 'mengenai', 'soal', 'kalau', 'jika', 'bila', 'apabila', 'saat',
    'waktu', 'ketika', 'lalu', 'kemudian', 'terus', 'terus apa', 'selain itu',
    'and', 'or', 'but', 'because', 'which', 'that', 'for', 'like', 'specifically',
    'about', 'regarding', 'if', 'when', 'then', 'also'
  ];

  static QUESTION_WORDS = [
    'apa', 'siapa', 'kapan', 'dimana', 'kenapa', 'mengapa', 'bagaimana', 'berapa',
    'apakah', 'bisakah', 'tolong', 'coba', 'what', 'who', 'when', 'where', 'why', 'how', 'can'
  ];

  /**
   * Evaluates whether the user has completed their turn.
   * @param {string} transcript - Current transcribed text
   * @param {number} silenceDurationMs - Silence duration detected since last word
   * @returns {Object} { isComplete, confidence, reason }
   */
  static evaluate(transcript, silenceDurationMs = 0) {
    if (!transcript || !transcript.trim()) {
      return { isComplete: false, confidence: 0, reason: 'EMPTY_TRANSCRIPT' };
    }

    const text = transcript.trim();
    const words = text.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1].replace(/[.,?!]/g, '');

    // 1. Check if sentence ends with a dangling conjunction (Definitely Unfinished)
    if (this.UNFINISHED_ENDINGS.includes(lastWord)) {
      return {
        isComplete: false,
        confidence: 0.1,
        reason: `DANGLING_CONJUNCTION_${lastWord.toUpperCase()}`
      };
    }

    // 2. Short utterances (< 3 words) without explicit intent
    if (words.length < 3) {
      if (['halo', 'hai', 'jin', 'salam', 'pagi', 'siang', 'malam', 'tes'].includes(words[0])) {
        // Simple greetings are complete if silence > 400ms
        return {
          isComplete: silenceDurationMs >= 400,
          confidence: 0.9,
          reason: 'SHORT_GREETING_COMPLETE'
        };
      }
      // Incomplete short phrase
      return {
        isComplete: silenceDurationMs >= 1500,
        confidence: 0.5,
        reason: 'SHORT_PHRASE_WAITING'
      };
    }

    // 3. Clear Complete Actions / Question with sufficient length
    const hasQuestion = this.QUESTION_WORDS.some(qw => text.toLowerCase().includes(qw));
    const hasActionVerb = /cari|putar|tampilkan|buatkan|analisis|jelaskan|bandingkan|search|play|show/i.test(text);

    if (hasActionVerb || hasQuestion) {
      // If actionable and silence >= 600ms, turn is complete
      if (silenceDurationMs >= 600) {
        return {
          isComplete: true,
          confidence: 0.95,
          reason: 'ACTIONABLE_TURN_COMPLETE'
        };
      }
    }

    // 4. Default natural conversational turn completion
    if (silenceDurationMs >= 800) {
      return {
        isComplete: true,
        confidence: 0.85,
        reason: 'NATURAL_PAUSE_COMPLETE'
      };
    }

    return {
      isComplete: false,
      confidence: 0.4,
      reason: 'LISTENING_STREAM'
    };
  }
}

export default TurnCompletionDetector;
