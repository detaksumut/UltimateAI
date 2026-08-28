/**
 * AgentRuntime.mjs
 * Central Autonomous Agent Loop Coordinator for UltimateAI 9Router.
 * 
 * Full Autonomous Decision Loop:
 *  UNDERSTAND ➔ FORM GOAL ➔ CHECK MEMORY (Drive F) ➔ IDENTIFY GAPS ➔ HIERARCHICAL PLAN
 *  ➔ SELECT TOOLS ➔ SELECT ENGINE ➔ SELECT POOL ➔ EXECUTE ➔ OBSERVE ➔ VERIFY
 *  ➔ UPDATE MEMORY ➔ REPLAN IF NEEDED ➔ RESPOND
 */

import { decisionEngineInstance } from './DecisionEngine.mjs';
import { AgentPlanner } from './AgentPlanner.mjs';
import { agentExecutorInstance } from './AgentExecutor.mjs';
import { AgentObserver } from './AgentObserver.mjs';
import { AgentVerifier } from './AgentVerifier.mjs';
import { replanEngineInstance } from './ReplanEngine.mjs';
import { jinResponseEngineInstance } from './JINResponseEngine.mjs';
import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';
import { KnowledgeGapDetector } from './KnowledgeGapDetector.mjs';
import { routingOptimizerInstance } from '../routing/RoutingOptimizer.mjs';
import { activeMemoryCoreInstance } from '../memory/ActiveMemoryCore.mjs';

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
    const timeline = [];

    timeline.push({ event: 'TASK_CREATED', timestamp: new Date().toISOString(), goal: rawGoal });

    // 1. SEMANTIC DECISION ENGINE & KNOWLEDGE GAP ANALYSIS
    const decision = await decisionEngineInstance.decide(rawGoal, sessionContext, options);
    const gapAnalysis = KnowledgeGapDetector.analyzeGap(rawGoal, sessionContext);

    timeline.push({
      event: 'GOAL_INTERPRETED',
      intent: decision.intent,
      knowledgeGap: gapAnalysis.hasGap ? gapAnalysis.gapDescription : 'NONE',
      timestamp: new Date().toISOString()
    });

    // If pure conversation without task delegation
    if (!decision.actionRequired) {
      const responsePayload = await jinResponseEngineInstance.generateResponse({
        userUtterance: rawGoal,
        conversationContext: sessionContext,
        decision
      }, options);

      // Record performance telemetry
      routingOptimizerInstance.recordTaskOutcome({
        engine: decision.semanticModel || 'gemini-3.6-flash-high',
        taskCategory: decision.intent,
        latencyMs: Date.now() - startTime,
        success: true,
        verified: true
      });

      const summary = {
        goal: rawGoal,
        success: true,
        confidence: 1.0,
        actionRequired: false,
        intent: decision.intent,
        interpretationSource: decision.interpretationSource,
        responseSource: responsePayload.responseSource,
        transportUsed: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY',
        provenance: {
          semanticModel: decision.semanticModel || options.forcedModel || 'gemini-3.6-flash-high',
          planningEngine: 'hierarchical_semantic_dag_planner',
          executionTools: [],
          modelInvocations: [
            {
              model: decision.semanticModel || options.forcedModel || 'gemini-3.6-flash-high',
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
        timeline,
        durationMs: Date.now() - startTime
      };

      this.sessionGoalHistory.push(summary);
      return summary;
    }

    // 2. HIERARCHICAL TASK PLANNING (LLM + Dynamic 9-Engine Routing)
    let currentPlan = await AgentPlanner.planGoal(rawGoal, {
      ...sessionContext,
      semanticDecision: decision,
      gapAnalysis
    });

    timeline.push({
      event: 'PLAN_CREATED',
      category: currentPlan.category,
      hierarchicalObjectives: currentPlan.hierarchicalObjectives,
      selectedEngine: currentPlan.selectedEngine,
      selectedPool: currentPlan.selectedPool,
      totalSteps: currentPlan.steps.length,
      timestamp: new Date().toISOString()
    });

    // Save initial active state snapshot to Drive F
    activeMemoryCoreInstance.snapshotActiveState({
      taskId: currentPlan.goalId,
      goal: rawGoal,
      currentStep: 1,
      activeTools: currentPlan.steps.map(s => s.tool).filter(Boolean),
      selectedPool: currentPlan.selectedPool,
      selectedModel: currentPlan.selectedEngine
    });

    // 3. AUTONOMOUS PLAN-ACT-OBSERVE-VERIFY-REPLAN LOOP
    let attempt = 0;
    let finalVerification = null;
    const fullExecutionHistory = [];
    const executionToolsUsed = [];
    const modelInvocations = [];

    modelInvocations.push({
      model: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
      pool: currentPlan.selectedPool || 'POOL_1',
      purpose: 'hierarchical_planning',
      transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
    });

    while (attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
      attempt++;
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

        timeline.push({
          event: 'ACTION_EXECUTED',
          stepId: step.id,
          subgoal: step.subgoal || step.action,
          tool: step.tool,
          timestamp: new Date().toISOString()
        });

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

        // If step failed, break immediately to trigger bounded replan
        if (!observation.valid) {
          timeline.push({
            event: 'ACTION_FAILED',
            stepId: step.id,
            error: observation.error || 'Execution validation failed',
            timestamp: new Date().toISOString()
          });
          break;
        }
      }

      fullExecutionHistory.push({ attempt, plan: currentPlan, currentHistory });

      // 4. VERIFY
      const verification = AgentVerifier.verifyGoalCompletion(currentPlan, currentHistory);
      finalVerification = verification;

      timeline.push({
        event: 'VERIFICATION_EVALUATED',
        isSatisfied: verification.isSatisfied,
        confidence: verification.confidence,
        timestamp: new Date().toISOString()
      });

      if (verification.isSatisfied) {
        // Goal satisfied! If research findings exist, pipe verified knowledge into Drive F Active Memory
        for (const h of currentHistory) {
          if (h.step.tool === 'web.fetch' || h.step.tool === 'web.search') {
            const res = h.stepResult?.result;
            if (res && res.text) {
              activeMemoryCoreInstance.store({
                key: `verified_${Date.now()}`,
                content: res.text.slice(0, 500),
                category: 'RESEARCH_DATA',
                priority: 'MEDIUM',
                source: { provenance: 'AUTONOMOUS_LIVE_RESEARCH', url: res.url || res.query }
              });
            }
          }
        }
        break;
      }

      // 5. ADAPTIVE BOUNDED REPLANNING
      if (verification.requiresReplan && attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
        timeline.push({
          event: 'REPLAN_TRIGGERED',
          attempt,
          reason: verification.failureReason,
          timestamp: new Date().toISOString()
        });

        const replanResult = await replanEngineInstance.generateReplan({
          originalGoal: rawGoal,
          failedStep: verification.failedStep,
          observedFailure: { reason: verification.failureReason },
          executionHistory: currentHistory,
          attempt
        });

        if (replanResult && replanResult.replacementPlan) {
          currentPlan = replanResult.replacementPlan;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 6. RECORD ROUTING PERFORMANCE TELEMETRY
    routingOptimizerInstance.recordTaskOutcome({
      engine: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
      taskCategory: currentPlan.category,
      latencyMs: durationMs,
      success: finalVerification?.isSatisfied || false,
      verified: finalVerification?.isSatisfied || false
    });

    // 7. JIN NATURAL RESPONSE SYNTHESIS
    const responsePayload = await jinResponseEngineInstance.generateResponse({
      userUtterance: rawGoal,
      conversationContext: sessionContext,
      decision,
      executionHistory: fullExecutionHistory[0]?.currentHistory || [],
      artifact: finalVerification?.artifact,
      verification: finalVerification,
      provenance: {
        semanticModel: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
        planningEngine: 'hierarchical_dynamic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        pool: currentPlan.selectedPool || 'POOL_1',
        transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
      }
    }, options);

    timeline.push({ event: 'TASK_COMPLETED', success: finalVerification?.isSatisfied || false, timestamp: new Date().toISOString() });

    const summary = {
      goal: rawGoal,
      success: finalVerification?.isSatisfied || false,
      confidence: finalVerification?.confidence || 0.95,
      actionRequired: true,
      intent: decision.intent,
      attempts: attempt,
      responseMessage: responsePayload.naturalVoiceSpeech,
      detailedDisplay: responsePayload.detailedTextDisplay,
      claims: responsePayload.claims,
      evidenceRefs: responsePayload.evidenceRefs,
      responseSource: responsePayload.responseSource,
      artifact: finalVerification?.artifact || null,
      provenance: {
        semanticModel: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
        planningEngine: 'hierarchical_dynamic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        selectedPool: currentPlan.selectedPool || 'POOL_1',
        modelInvocations,
        transport: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY'
      },
      interpretationSource: decision.interpretationSource,
      transportUsed: decision.transportUsed || options.certificationTransport || 'NINE_ROUTER_PROXY',
      fallbackUsed: decision.fallbackUsed,
      timeline,
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
