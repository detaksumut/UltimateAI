/**
 * AgentRuntime.mjs
 * Central Autonomous Agent Loop Coordinator for UltimateAI 9Router.
 * Integrates JINResponseEngine with Claim-to-Evidence Grounding & Fail-Closed Support.
 */

import { decisionEngineInstance } from './DecisionEngine.mjs';
import { AgentPlanner } from './AgentPlanner.mjs';
import { agentExecutorInstance } from './AgentExecutor.mjs';
import { AgentObserver } from './AgentObserver.mjs';
import { AgentVerifier } from './AgentVerifier.mjs';
import { replanEngineInstance } from './ReplanEngine.mjs';
import { jinResponseEngineInstance } from './JINResponseEngine.mjs';
import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

export class AgentRuntime {
  constructor() {
    this.sessionGoalHistory = [];
  }

  /**
   * Main Autonomous Execution Loop
   * @param {string} userGoal - User spoken/typed natural input
   * @param {Object} sessionContext - Context, previous turns, memory
   * @param {Object} options - { failClosed: boolean, forcedModel: string, certificationTransport: 'NINE_ROUTER_PROXY' | 'DIRECT_PROVIDER' }
   * @returns {Promise<Object>} executionSummary
   */
  async runGoal(userGoal, sessionContext = {}, options = {}) {
    const startTime = Date.now();
    const rawGoal = userGoal || '';

    // 1. SEMANTIC DECISION ENGINE (LLM Interpretation with Fail-Closed & Transport options)
    const decision = await decisionEngineInstance.decide(rawGoal, sessionContext, options);

    // If pure conversation without task delegation
    if (!decision.actionRequired) {
      const responsePayload = await jinResponseEngineInstance.generateResponse({
        userUtterance: rawGoal,
        conversationContext: sessionContext,
        decision
      }, options);

      return {
        goal: rawGoal,
        success: true,
        confidence: 1.0,
        actionRequired: false,
        intent: decision.intent,
        interpretationSource: decision.interpretationSource,
        responseSource: responsePayload.responseSource,
        transportUsed: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY',
        provenance: {
          semanticModel: decision.semanticModel || options.forcedModel || 'gemini-3.5-flash',
          planningEngine: 'deterministic_semantic_dag_planner',
          executionTools: [],
          modelInvocations: [
            {
              model: decision.semanticModel || options.forcedModel || 'gemini-3.5-flash',
              purpose: 'semantic_intent_interpretation',
              transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
            }
          ],
          transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
        },
        fallbackUsed: decision.fallbackUsed,
        responseMessage: responsePayload.naturalVoiceSpeech,
        detailedDisplay: responsePayload.detailedTextDisplay,
        claims: responsePayload.claims,
        evidenceRefs: responsePayload.evidenceRefs,
        durationMs: Date.now() - startTime
      };
    }

    // 2. AUTONOMOUS PLAN-ACT-OBSERVE-VERIFY-REPLAN LOOP
    let attempt = 0;
    let finalVerification = null;
    let currentPlan = null;
    const fullExecutionHistory = [];
    const executionToolsUsed = [];
    const modelInvocations = [];

    // Record semantic interpretation model invocation
    modelInvocations.push({
      model: decision.semanticModel || options.forcedModel || 'gemini-3.5-flash',
      purpose: 'semantic_intent_interpretation',
      transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
    });

    // Initial Semantic Plan
    currentPlan = AgentPlanner.planGoal(rawGoal, { ...sessionContext, semanticDecision: decision });

    while (attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
      attempt++;

      // A. EXECUTE & OBSERVE (Step-by-Step with Dependency Checking)
      const currentHistory = [];

      for (const step of currentPlan.steps) {
        // Verify dependencies
        const depsMet = (step.dependsOn || []).every(depId => 
          currentHistory.some(h => (h.step.id === depId || h.step.stepId === depId) && h.observation?.valid)
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
          sessionContext,
          options
        });

        const observation = AgentObserver.observe(step, stepResult);

        if (step.tool) {
          executionToolsUsed.push(step.tool);
        }

        currentHistory.push({
          step,
          stepResult,
          observation,
          timestamp: new Date().toISOString()
        });

        // If step failed, break immediately to trigger adaptive replanner
        if (!observation.valid) {
          break;
        }
      }

      fullExecutionHistory.push({ attempt, plan: currentPlan, currentHistory });

      // B. VERIFY (Outcome & Evidence Contract Inspection)
      const verification = AgentVerifier.verifyGoalCompletion(currentPlan, currentHistory);
      finalVerification = verification;

      if (verification.isSatisfied) {
        // Goal verified & contract met!
        break;
      }

      // C. ADAPTIVE REPLANNING: Directly apply replacement DAG plan
      if (verification.requiresReplan && attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
        const replanResult = await replanEngineInstance.generateReplan({
          originalGoal: rawGoal,
          failedStep: verification.failedStep,
          observedFailure: { reason: verification.failureReason },
          executionHistory: currentHistory,
          attempt
        });

        // Directly apply replacement DAG plan for next execution cycle
        if (replanResult && replanResult.replacementPlan) {
          currentPlan = replanResult.replacementPlan;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. JIN RESPONSE INTELLIGENCE (Synthesize Evidence-Bound Speech & Display)
    const responsePayload = await jinResponseEngineInstance.generateResponse({
      userUtterance: rawGoal,
      conversationContext: sessionContext,
      decision,
      executionHistory: fullExecutionHistory[0]?.currentHistory || [],
      artifact: finalVerification?.artifact,
      verification: finalVerification,
      provenance: {
        semanticModel: decision.semanticModel || options.forcedModel || 'gemini-3.5-flash',
        planningEngine: 'deterministic_semantic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
      }
    }, options);

    const summary = {
      goal: rawGoal,
      success: finalVerification?.isSatisfied || false,
      confidence: finalVerification?.confidence || 0.95,
      actionRequired: true,
      attempts: attempt,
      responseMessage: responsePayload.naturalVoiceSpeech,
      detailedDisplay: responsePayload.detailedTextDisplay,
      claims: responsePayload.claims,
      evidenceRefs: responsePayload.evidenceRefs,
      responseSource: responsePayload.responseSource,
      artifact: finalVerification?.artifact || null,
      provenance: {
        semanticModel: decision.semanticModel || options.forcedModel || 'gemini-3.5-flash',
        planningEngine: 'deterministic_semantic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        modelInvocations,
        transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
      },
      interpretationSource: decision.interpretationSource,
      transportUsed: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY',
      fallbackUsed: decision.fallbackUsed,
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
