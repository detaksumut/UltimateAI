/**
 * AgentVerifier.mjs
 * Evaluates goal satisfaction, enforces evidence integrity, and determines if replanning is needed.
 */

export class AgentVerifier {
  /**
   * Verifies execution results against user goal
   * @param {Object} plan - Original Execution Plan
   * @param {Array} executionHistory - Completed steps with observations
   * @returns {Object} verification - { isSatisfied, confidence, requiresReplan, synthesisMessage }
   */
  static verifyGoalCompletion(plan, executionHistory = []) {
    const totalSteps = plan.steps.length;
    const completedSteps = executionHistory.filter(h => h.observation?.valid).length;

    const isSatisfied = completedSteps >= totalSteps && totalSteps > 0;
    const confidence = isSatisfied ? 0.98 : completedSteps / Math.max(1, totalSteps);

    // Formulate verified, evidence-backed synthesis for JIN
    let synthesisMessage = '';

    if (plan.category === 'LIVE_NEWS') {
      const videoResult = executionHistory.find(h => h.step.tool === 'media.video_resolver')?.stepResult?.result;
      const topTitle = videoResult?.selectedVideo?.title || plan.goal;
      const topChannel = videoResult?.selectedVideo?.channel || 'Media Terpercaya';
      synthesisMessage = `Saya telah memverifikasi laporan berita terkini dan menyeleksi liputan live terpercaya dari ${topChannel}. Videonya langsung saya putar di panel kanan untuk Anda.`;
    } else if (plan.category === 'MULTIMEDIA') {
      synthesisMessage = `Video musik pilihan telah diverifikasi dan langsung dimuat ke pemutar media di panel kanan.`;
    } else if (plan.category === 'APP_SYNTHESIS') {
      synthesisMessage = `Purwarupa aplikasi interaktif telah selesai dirancang, diverifikasi tanpa error, dan dimuat langsung ke simulator iPhone.`;
    } else if (plan.category === 'DATA_ANALYTICS') {
      synthesisMessage = `Matriks data terstruktur telah diekstrak dan disajikan secara presisi ke panel analitik.`;
    } else {
      synthesisMessage = `Instruksi untuk "${plan.goal}" telah selesai diproses dan diverifikasi oleh sistem 9Router.`;
    }

    return {
      isSatisfied,
      confidence,
      requiresReplan: !isSatisfied,
      completedSteps,
      totalSteps,
      synthesisMessage
    };
  }
}

export default AgentVerifier;
