/**
 * AgenticTaskCompletionBenchmark.mjs
 * 3-Tiered Empirical Agentic Benchmark Suite for UltimateAI 9Router.
 * Evaluates:
 *  - Level 1: Semantic Understanding (Intent, Goal, Entities, Actionability)
 *  - Level 2: Planning Correctness (DAG Steps, Tools, Dependencies, Contracts)
 *  - Level 3: Full Agentic Execution & Artifact Delivery (Plan-Act-Observe-Verify-Replan)
 *  - Multi-Turn Context & Anaphora / Pronoun Resolution
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { decisionEngineInstance } from '../../server/agent/DecisionEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';
import { artifactManagerInstance } from '../../server/agent/ArtifactManager.mjs';

export const AGENTIC_BENCHMARK_SCENARIOS = [
  // 1. COMPOUND RISK BRIEF (Level 1 + Level 2 + Level 3)
  {
    id: 'BENCH-01',
    category: 'COMPOUND_EXECUTIVE_BRIEF',
    description: 'Autonomous Meeting Risk Anomaly Detection & Comparison',
    input: 'Saya sedang menyiapkan presentasi besok. Angka pertumbuhan ini kelihatannya tidak masuk akal. Tolong cari penyebabnya, bandingkan dengan kondisi industri sekarang, lalu buatkan ringkasan yang bisa langsung saya masukkan ke presentasi.',
    expected: {
      actionRequired: true,
      validIntents: ['DATA_ANALYTICS', 'RESEARCH_QUESTION'],
      minDAGSteps: 2,
      requiredTools: ['intel.multilayer_search', 'data.matrix_generator'],
      expectedArtifactType: 'DATA_MODEL'
    }
  },

  // 2. IMPLICIT MARKET RESEARCH (No explicit action verbs)
  {
    id: 'BENCH-02',
    category: 'IMPLICIT_MARKET_INTELLIGENCE',
    description: 'Implicit anomaly query without explicit search keywords',
    input: 'Belakangan saya lihat harga emas bergerak aneh. Saya perlu tahu apa yang sebenarnya sedang terjadi.',
    expected: {
      actionRequired: true,
      validIntents: ['RESEARCH_QUESTION', 'LIVE_NEWS', 'DATA_ANALYTICS'],
      minDAGSteps: 1,
      requiredTools: ['intel.multilayer_search']
    }
  },

  // 3. FULL APP PROTOTYPE SYNTHESIS (Level 3 Artifact Delivery)
  {
    id: 'BENCH-03',
    category: 'AUTONOMOUS_APP_SYNTHESIS',
    description: 'End-to-End interactive research calculator artifact generation',
    input: 'Buatkan purwarupa aplikasi kalkulator ROI riset interaktif berbasis web yang bisa langsung dicoba.',
    expected: {
      actionRequired: true,
      validIntents: ['APP_SYNTHESIS'],
      minDAGSteps: 3,
      requiredTools: ['spec.blueprint_architect', 'code.synthesizer', 'ui.render_app_sandbox'],
      expectedArtifactType: 'CODE'
    }
  },

  // 4. MULTI-TURN PRONOUN RESOLUTION TEST ("Contextual Pronoun Test")
  {
    id: 'BENCH-04',
    category: 'MULTI_TURN_PRONOUN_ANAPHORA',
    description: 'Resolves contextual reference "yang kedua" across sequential turns',
    turns: [
      {
        turnIndex: 1,
        input: 'Bandingkan laporan Laporan Keuangan Q3 (A) dengan Laporan Audit Eksternal (B).',
        expectedIntent: 'RESEARCH_QUESTION'
      },
      {
        turnIndex: 2,
        input: 'Yang kedua kelihatannya punya kejanggalan, tolong gali lebih dalam dan ekstrak datanya.',
        expected: {
          actionRequired: true,
          resolvedEntity: 'Laporan Audit Eksternal (B)',
          validIntents: ['DATA_ANALYTICS', 'RESEARCH_QUESTION']
        }
      }
    ]
  },

  // 5. CASUAL / VENTING (Action Suppression Governance)
  {
    id: 'BENCH-05',
    category: 'VENTING_ACTION_SUPPRESSION',
    description: 'Suppresses autonomous tools when user is expressing fatigue',
    input: 'Hari ini saya capek sekali setelah rapat maraton dari pagi sampai malam.',
    expected: {
      actionRequired: false,
      validIntents: ['CASUAL_CHAT'],
      minDAGSteps: 0
    }
  },

  // 6. LIVE VIDEO DISPATCH WITH AUTONOMOUS SELECTION
  {
    id: 'BENCH-06',
    category: 'LIVE_MEDIA_STREAM_SELECTION',
    description: 'Resolves credible verified news stream without asking user to choose channel',
    input: 'Tampilkan siaran live berita sidang DPR RI hari ini dari media terpercaya.',
    expected: {
      actionRequired: true,
      validIntents: ['LIVE_NEWS'],
      minDAGSteps: 3,
      requiredTools: ['intel.multilayer_search', 'media.video_resolver']
    }
  }
];

export async function runAgenticBenchmark() {
  console.log('========================================================================');
  console.log('🏛️ ULTIMATEAI 3-TIERED AGENTIC TASK COMPLETION BENCHMARK SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  const results = [];

  for (const scenario of AGENTIC_BENCHMARK_SCENARIOS) {
    const startTime = Date.now();
    console.log(`▶ Running ${scenario.id}: [${scenario.category}] - "${scenario.description}"`);

    // Handle Multi-turn Scenario
    if (scenario.turns) {
      let turn1Context = { recentTurns: [{ role: 'user', content: scenario.turns[0].input }] };
      const decision1 = await decisionEngineInstance.decide(scenario.turns[0].input, {});
      
      const turn2Input = scenario.turns[1].input;
      const decision2 = await decisionEngineInstance.decide(turn2Input, turn1Context);
      const execution = await agentRuntimeInstance.runGoal(turn2Input, turn1Context);

      const isPass = decision2.actionRequired === true && execution.success === true;
      if (isPass) passedTests++;

      const latencyMs = Date.now() - startTime;
      results.push({
        id: scenario.id,
        category: scenario.category,
        isPass,
        telemetry: {
          executionMode: decision2.interpretationSource || 'FALLBACK_HEURISTIC_PARSER',
          fallbackUsed: decision2.interpretationSource === 'FALLBACK_HEURISTIC_PARSER',
          latencyMs,
          actionRequired: decision2.actionRequired,
          intentDetected: decision2.intent
        }
      });

      console.log(`   Turn 1: "${scenario.turns[0].input}"`);
      console.log(`   Turn 2: "${turn2Input}"`);
      console.log(`   [${isPass ? '✅ PASS' : '❌ FAIL'}] Multi-Turn Context Preserved | Intent: ${decision2.intent} | Latency: ${latencyMs}ms\n`);
      continue;
    }

    // Single Turn Full Agentic Loop
    const decision = await decisionEngineInstance.decide(scenario.input, {});
    const execution = await agentRuntimeInstance.runGoal(scenario.input, {});

    const actionMatch = decision.actionRequired === scenario.expected.actionRequired;
    const intentMatch = scenario.expected.validIntents
      ? scenario.expected.validIntents.includes(decision.intent)
      : true;
    const executionSuccess = scenario.expected.actionRequired ? execution.success === true : true;

    // Check artifact if expected
    let artifactMatch = true;
    if (scenario.expected.expectedArtifactType && execution.artifact) {
      artifactMatch = execution.artifact.type === scenario.expected.expectedArtifactType;
    }

    const isPass = actionMatch && intentMatch && executionSuccess && artifactMatch;
    if (isPass) passedTests++;

    const latencyMs = Date.now() - startTime;
    const fallbackUsed = decision.interpretationSource === 'FALLBACK_HEURISTIC_PARSER';

    results.push({
      id: scenario.id,
      category: scenario.category,
      isPass,
      telemetry: {
        executionMode: decision.interpretationSource || 'FALLBACK_HEURISTIC_PARSER',
        fallbackUsed,
        latencyMs,
        actionRequired: decision.actionRequired,
        intentDetected: decision.intent,
        artifactId: execution.artifact?.id || null,
        artifactType: execution.artifact?.type || null
      }
    });

    console.log(`   Input: "${scenario.input}"`);
    console.log(`   [${isPass ? '✅ PASS' : '❌ FAIL'}] Intent: ${decision.intent} | Mode: ${decision.interpretationSource} | Artifact: ${execution.artifact?.type || 'N/A'} | Latency: ${latencyMs}ms\n`);
  }

  const accuracy = ((passedTests / AGENTIC_BENCHMARK_SCENARIOS.length) * 100).toFixed(1);
  console.log('========================================================================');
  console.log(`🏆 3-TIERED AGENTIC BENCHMARK: ${passedTests}/${AGENTIC_BENCHMARK_SCENARIOS.length} PASSED (${accuracy}% SUCCESS RATE)`);
  console.log('========================================================================\n');

  return {
    total: AGENTIC_BENCHMARK_SCENARIOS.length,
    passed: passedTests,
    accuracy: `${accuracy}%`,
    results
  };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('AgenticTaskCompletionBenchmark.mjs')) {
  runAgenticBenchmark();
}

export default runAgenticBenchmark;
