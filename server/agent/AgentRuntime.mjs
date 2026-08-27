/**
 * AgentRuntime.mjs
 * Central Autonomous Agent Loop Coordinator for UltimateAI 9Router.
 * Implements: SEMANTIC_DECISION ➔ PLAN (DAG Graph) ➔ EXECUTE ➔ OBSERVE ➔ VERIFY ➔ ADAPTIVE_REPLAN
 */

import { decisionEngineInstance } from './DecisionEngine.mjs';
import { AgentPlanner } from './AgentPlanner.mjs';
import { agentExecutorInstance } from './AgentExecutor.mjs';
import { AgentObserver } from './AgentObserver.mjs';
import { AgentVerifier } from './AgentVerifier.mjs';
import { replanEngineInstance } from './ReplanEngine.mjs';
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
    const rawGoal = userGoal || '';

    // 1. SEMANTIC DECISION ENGINE
    const decision = await decisionEngineInstance.decide(rawGoal, sessionContext);

    // If pure conversation without task delegation
    if (!decision.actionRequired) {
      return {
        goal: rawGoal,
        success: true,
        confidence: 1.0,
        actionRequired: false,
        intent: decision.intent,
        responseMessage: `Halo! Saya JIN. Saya siap membantu mengeksekusi pencarian data multi-layer, analisis, pemutaran media, atau pembuatan aplikasi instan secara mandiri.`,
        durationMs: Date.now() - startTime
      };
    }

    // 2. AUTONOMOUS PLAN-ACT-OBSERVE-VERIFY-REPLAN LOOP
    let currentGoal = rawGoal;
    let attempt = 0;
    let finalVerification = null;
    let currentPlan = null;
    const fullExecutionHistory = [];

    while (attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
      attempt++;

      // A. PLAN (DAG Execution Graph)
      currentPlan = AgentPlanner.planGoal(currentGoal, { ...sessionContext, semanticDecision: decision });

      // B. EXECUTE & OBSERVE (Step-by-Step with Dependency Checking)
      const currentHistory = [];

      for (const step of currentPlan.steps) {
        // Verify dependencies
        const depsMet = step.dependsOn.every(depId => 
          currentHistory.some(h => h.step.id === depId && h.observation?.valid)
        );

        if (!depsMet) {
          currentHistory.push({
            step,
            stepResult: { success: false, error: 'DEPENDENCY_NOT_MET' },
            observation: { valid: false, status: 'BLOCKED_DEPENDENCY', error: 'Dependencies not satisfied' }
          });
          break;
        }

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

        // If step failed, stop this attempt to trigger adaptive replanner
        if (!observation.valid) {
          break;
        }
      }

      fullExecutionHistory.push({ attempt, plan: currentPlan, currentHistory });

      // C. VERIFY (Outcome & Evidence Contract Inspection)
      const verification = AgentVerifier.verifyGoalCompletion(currentPlan, currentHistory);
      finalVerification = verification;

      if (verification.isSatisfied) {
        // Goal verified & achieved!
        break;
      }

      // D. ADAPTIVE REPLANNING with failure evidence
      if (verification.requiresReplan && attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
        const replanResult = await replanEngineInstance.generateReplan({
          originalGoal: rawGoal,
          failedStep: verification.failedStep,
          observedFailure: { reason: verification.failureReason },
          executionHistory: currentHistory,
          attempt
        });

        // If replanner provided alternate steps, update goal context
        currentGoal = `Replan [${replanResult.strategyAdjustment}]: ${rawGoal}`;
      }
    }

    const durationMs = Date.now() - startTime;

    const summary = {
      goal: rawGoal,
      success: finalVerification?.isSatisfied || false,
      confidence: finalVerification?.confidence || 0.95,
      actionRequired: true,
      attempts: attempt,
      responseMessage: finalVerification?.synthesisMessage || 'Instruksi telah selesai diproses dan diverifikasi oleh sistem 9Router.',
      artifact: finalVerification?.artifact || null,
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
