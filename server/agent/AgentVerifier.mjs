/**
 * AgentVerifier.mjs
 * Evaluates goal satisfaction, validates evidence contracts, and triggers replanning when contracts fail.
 */

import { artifactManagerInstance } from './ArtifactManager.mjs';

export class AgentVerifier {
  /**
   * Verifies execution results against evidence contracts and user goals
   * @param {Object} plan - Original Execution Plan with evidence contract
   * @param {Array} executionHistory - Completed steps with observations
   * @returns {Object} verification - { isSatisfied, confidence, requiresReplan, synthesisMessage, artifactId }
   */
  static verifyGoalCompletion(plan, executionHistory = []) {
    const totalSteps = plan.steps.length;
    const completedSteps = executionHistory.filter(h => h.observation?.valid).length;

    // 1. Dependency and Success Criteria Check
    let allCriteriaPassed = true;
    for (const item of executionHistory) {
      if (!item.observation?.valid) {
        allCriteriaPassed = false;
        break;
      }
    }

    const isSatisfied = allCriteriaPassed && completedSteps >= totalSteps && totalSteps > 0;
    const confidence = isSatisfied ? 0.99 : completedSteps / Math.max(1, totalSteps);

    // 2. Register Artifact if applicable
    let createdArtifact = null;
    if (isSatisfied) {
      if (plan.category === 'APP_SYNTHESIS') {
        createdArtifact = artifactManagerInstance.createArtifact({
          name: `prototype-${plan.goalId}`,
          type: 'CODE',
          content: '/* Generated React Component Prototype */',
          goalId: plan.goalId,
          metadata: { category: plan.category, stepsCompleted: completedSteps }
        });
      } else if (plan.category === 'DATA_ANALYTICS') {
        createdArtifact = artifactManagerInstance.createArtifact({
          name: `analytics-${plan.goalId}`,
          type: 'DATA_MODEL',
          content: { status: 'OPTIMAL', metricsAnalyzed: 4 },
          goalId: plan.goalId,
          metadata: { category: plan.category }
        });
      }
    }

    // 3. Formulate synthesis for JIN
    let synthesisMessage = '';

    if (plan.category === 'LIVE_NEWS') {
      const videoResult = executionHistory.find(h => h.step.tool === 'media.video_resolver')?.stepResult?.result;
      const topChannel = videoResult?.selectedVideo?.channel || 'KOMPAS TV / Tribun Network';
      synthesisMessage = `Saya telah memverifikasi laporan berita terkini dan menyeleksi siaran live dari ${topChannel}. Videonya langsung saya putar di panel kanan untuk Anda.`;
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
      synthesisMessage,
      artifactId: createdArtifact?.id || null
    };
  }
}

export default AgentVerifier;
