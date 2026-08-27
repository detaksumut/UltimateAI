/**
 * AgentRuntime.mjs
 * Central Autonomous Agent Loop Coordinator for UltimateAI 9Router.
 * Implements: UNDERSTAND ➔ PLAN ➔ EXECUTE ➔ OBSERVE ➔ VERIFY ➔ REPLAN
 */

import { AgentPlanner } from './AgentPlanner.mjs';
import { agentExecutorInstance } from './AgentExecutor.mjs';
import { AgentObserver } from './AgentObserver.mjs';
import { AgentVerifier } from './AgentVerifier.mjs';
import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

export class AgentRuntime {
  constructor() {
    this.sessionGoalHistory = [];
  }

  /**
   * Main Autonomous Execution Loop
   * @param {string} userGoal - User spoken/typed natural input
   * @param {Object} sessionContext - Context, previous turns, memory
   * @returns {Promise<Object>} executionSummary
   */
  async runGoal(userGoal, sessionContext = {}) {
    const startTime = Date.now();
    let currentGoal = userGoal;
    let attempt = 0;
    let finalVerification = null;
    const fullExecutionHistory = [];

    while (attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
      attempt++;

      // 1. UNDERSTAND & PLAN
      const plan = AgentPlanner.planGoal(currentGoal, sessionContext);

      // 2. EXECUTE & OBSERVE (Step-by-Step)
      const currentHistory = [];

      for (const step of plan.steps) {
        const stepResult = await agentExecutorInstance.executeStep(step, {
          priorHistory: currentHistory,
          sessionContext
        });

        const observation = AgentObserver.observe(step, stepResult);

        currentHistory.push({
          step,
          stepResult,
          observation,
          timestamp: new Date().toISOString()
        });

        // Break if critical failure
        if (!observation.valid) {
          break;
        }
      }

      fullExecutionHistory.push({ attempt, plan, currentHistory });

      // 3. VERIFY
      const verification = AgentVerifier.verifyGoalCompletion(plan, currentHistory);
      finalVerification = verification;

      if (verification.isSatisfied) {
        // Goal achieved!
        break;
      }

      // Replan if needed
      if (verification.requiresReplan && attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
        currentGoal = `Replan attempt ${attempt + 1}: ${userGoal}`;
      }
    }

    const durationMs = Date.now() - startTime;

    const summary = {
      goal: userGoal,
      success: finalVerification?.isSatisfied || false,
      confidence: finalVerification?.confidence || 0.9,
      attempts: attempt,
      responseMessage: finalVerification?.synthesisMessage || 'Instruksi telah diproses oleh sistem.',
      durationMs,
      telemetry: {
        totalStepsExecuted: fullExecutionHistory.reduce((acc, h) => acc + h.currentHistory.length, 0),
        status: finalVerification?.isSatisfied ? 'VERIFIED_COMPLETED' : 'PARTIAL_COMPLETED'
      }
    };

    this.sessionGoalHistory.push(summary);
    return summary;
  }
}

export const agentRuntimeInstance = new AgentRuntime();
export default agentRuntimeInstance;
