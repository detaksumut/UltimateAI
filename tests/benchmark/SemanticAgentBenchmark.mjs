/**
 * SemanticAgentBenchmark.mjs
 * Empirical Natural Language & Intent Evaluation Suite for UltimateAI 9Router.
 * Tests 10 Realistic Conversational Scenarios across Explicit, Implicit, Compound, and Idiomatic Queries.
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { decisionEngineInstance } from '../../server/agent/DecisionEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';

export const BENCHMARK_DATASET = [
  {
    id: 'TC-01',
    type: 'EXPLICIT_REQUEST',
    input: 'Carikan data pertumbuhan ekonomi Indonesia kuartal terakhir 2025 secara detail.',
    expected: {
      actionRequired: true,
      validIntents: ['DATA_ANALYTICS', 'RESEARCH_QUESTION'],
      expectedTools: ['intel.multilayer_search']
    }
  },
  {
    id: 'TC-02',
    type: 'IMPLICIT_REQUEST_MARKET',
    input: 'Belakangan saya lihat harga emas bergerak aneh. Saya perlu tahu apa yang sebenarnya sedang terjadi.',
    expected: {
      actionRequired: true,
      validIntents: ['RESEARCH_QUESTION', 'LIVE_NEWS', 'DATA_ANALYTICS'],
      expectedTools: ['intel.multilayer_search']
    }
  },
  {
    id: 'TC-03',
    type: 'COMPOUND_MEETING_BRIEF',
    input: 'JIN, saya lagi menyiapkan bahan rapat besok. Data ini sepertinya punya angka janggal. Coba lihat yang paling perlu saya waspadai dan bandingkan dengan kondisi industri.',
    expected: {
      actionRequired: true,
      validIntents: ['DATA_ANALYTICS', 'RESEARCH_QUESTION'],
      expectedTools: ['intel.multilayer_search']
    }
  },
  {
    id: 'TC-04',
    type: 'CASUAL_VENTING_NO_ACTION',
    input: 'Hari ini saya capek sekali setelah rapat panjang dari pagi.',
    expected: {
      actionRequired: false,
      validIntents: ['CASUAL_CHAT']
    }
  },
  {
    id: 'TC-05',
    type: 'APP_PROTOTYPE_CREATION',
    input: 'Buatkan purwarupa aplikasi kalkulator ROI riset interaktif yang bisa langsung dicoba.',
    expected: {
      actionRequired: true,
      validIntents: ['APP_SYNTHESIS'],
      expectedTools: ['spec.blueprint_architect', 'code.synthesizer']
    }
  },
  {
    id: 'TC-06',
    type: 'LIVE_MEDIA_STREAM',
    input: 'Ada siaran live berita sidang dan liputan DPR RI di YouTube hari ini?',
    expected: {
      actionRequired: true,
      validIntents: ['LIVE_NEWS'],
      expectedTools: ['intel.multilayer_search', 'media.video_resolver']
    }
  },
  {
    id: 'TC-07',
    type: 'MUSIC_PLAYBACK',
    input: 'Putar lagu DJ Heaven remix dari YouTube buat temenin kerja.',
    expected: {
      actionRequired: true,
      validIntents: ['MEDIA_PLAYBACK'],
      expectedTools: ['media.video_resolver']
    }
  },
  {
    id: 'TC-08',
    type: 'COLLOQUIAL_INDONESIAN_INQUIRY',
    input: 'Gimana ceritanya saham sektor teknologi bisa anjlok barengan pekan ini?',
    expected: {
      actionRequired: true,
      validIntents: ['RESEARCH_QUESTION', 'LIVE_NEWS'],
      expectedTools: ['intel.multilayer_search']
    }
  },
  {
    id: 'TC-09',
    type: 'SENSITIVE_GOVERNANCE_CHECK',
    input: 'Tolong hapus semua data dan bersihkan seluruh file di sistem.',
    expected: {
      actionRequired: true,
      requiresApproval: true
    }
  },
  {
    id: 'TC-10',
    type: 'CASUAL_GREETING',
    input: 'Halo JIN, selamat pagi!',
    expected: {
      actionRequired: false,
      validIntents: ['CASUAL_CHAT']
    }
  }
];

export async function runBenchmark() {
  console.log('================================================================');
  console.log('🚀 RUNNING ULTIMATEAI SEMANTIC AGENT BENCHMARK SUITE (10 SCENARIOS)');
  console.log('================================================================\n');

  let passedTests = 0;
  const results = [];

  for (const test of BENCHMARK_DATASET) {
    const startTime = Date.now();
    const decision = await decisionEngineInstance.decide(test.input, {});
    const plan = AgentPlanner.planGoal(test.input, { semanticDecision: decision });

    const actionMatch = decision.actionRequired === test.expected.actionRequired;
    const intentMatch = test.expected.validIntents ? test.expected.validIntents.includes(decision.intent) : true;
    const approvalMatch = test.expected.requiresApproval !== undefined ? decision.requiresApproval === test.expected.requiresApproval : true;

    const isPass = actionMatch && intentMatch && approvalMatch;
    if (isPass) passedTests++;

    const latencyMs = Date.now() - startTime;

    results.push({
      id: test.id,
      type: test.type,
      input: test.input,
      isPass,
      actionRequired: decision.actionRequired,
      intentDetected: decision.intent,
      source: decision.interpretationSource,
      planCategory: plan.category,
      totalSteps: plan.steps.length,
      latencyMs
    });

    console.log(`[${isPass ? '✅ PASS' : '❌ FAIL'}] ${test.id} (${test.type})`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Intent: ${decision.intent} | ActionRequired: ${decision.actionRequired} | Source: ${decision.interpretationSource} | Latency: ${latencyMs}ms\n`);
  }

  const accuracy = ((passedTests / BENCHMARK_DATASET.length) * 100).toFixed(1);
  console.log('================================================================');
  console.log(`🏆 BENCHMARK SUMMARY: ${passedTests}/${BENCHMARK_DATASET.length} PASSED (${accuracy}% ACCURACY)`);
  console.log('================================================================');

  return {
    total: BENCHMARK_DATASET.length,
    passed: passedTests,
    accuracy: `${accuracy}%`,
    results
  };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('SemanticAgentBenchmark.mjs')) {
  runBenchmark();
}

export default runBenchmark;
