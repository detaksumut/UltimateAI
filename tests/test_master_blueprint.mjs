/**
 * test_master_blueprint.mjs
 * Automated unit and integration test suite for UltimateAI 9Router + JIN Embodied Intelligence.
 */

import { AVATAR_STATES, AVATAR_EVENTS } from '../src/services/avatar/JinAvatarStates.js';
import { JinAvatarController } from '../src/services/avatar/JinAvatarController.js';
import { RouterConfig } from '../src/services/router/RouterConfig.js';
import { RouterStatus } from '../src/services/router/RouterStatus.js';
import { NineRouterClient } from '../src/services/router/NineRouterClient.js';
import { ContextManager } from '../src/services/conversation/ContextManager.js';
import { MemoryAdapter } from '../src/services/conversation/MemoryAdapter.js';
import { ConversationEngine } from '../src/services/conversation/ConversationEngine.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('====================================================');
console.log('   ULTIMATEAI 9ROUTER + JIN INTEGRATION TEST SUITE  ');
console.log('====================================================\n');

// 1. Test Avatar FSM Transitions
console.log('TEST 1: Avatar FSM State Transitions');
const avatar = new JinAvatarController();

assert(avatar.currentState === AVATAR_STATES.IDLE, 'Initial state is IDLE');

avatar.dispatch({ type: AVATAR_EVENTS.MIC_ACTIVATED });
assert(avatar.currentState === AVATAR_STATES.LISTENING, 'Transition to LISTENING upon MIC_ACTIVATED');

avatar.dispatch({ type: AVATAR_EVENTS.INPUT_COMPLETED });
assert(avatar.currentState === AVATAR_STATES.PROCESSING, 'Transition to PROCESSING upon INPUT_COMPLETED');

avatar.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY });
assert(avatar.currentState === AVATAR_STATES.SPEAKING, 'Transition to SPEAKING upon RESPONSE_READY');

// Test Barge-in
avatar.dispatch({ type: AVATAR_EVENTS.USER_BARGE_IN });
assert(avatar.currentState === AVATAR_STATES.INTERRUPTED, 'Transition to INTERRUPTED upon USER_BARGE_IN');

// Test Reset
avatar.dispatch({ type: AVATAR_EVENTS.RESET });
assert(avatar.currentState === AVATAR_STATES.IDLE, 'Reset returns avatar to IDLE');

console.log('');

// 2. Test Router Config & Zero Secret Exposure
console.log('TEST 2: Router Configuration & Security');
assert(RouterConfig.DEFAULT_LOCAL_ENDPOINT === 'http://localhost:20128/v1', 'Default endpoint points to 9Router Local Proxy');
assert(typeof RouterConfig.getEndpoint === 'function', 'getEndpoint function exists');
console.log('');

// 3. Test Router Telemetry
console.log('TEST 3: Router Status Telemetry');
const routerStatus = new RouterStatus();
assert(routerStatus.activeCount === 9, '9Router has 9 active routing engines configured');
assert(routerStatus.activeRoutes.length === 9, 'All 9 reasoning routes are registered');
console.log('');

// 4. Test ContextManager & Intent Detection
console.log('TEST 4: ContextManager & Intent Detection');
const contextManager = new ContextManager();
const intent1 = contextManager.detectIntent('Buatkan saya aplikasi kalkulator');
assert(intent1 === 'APP_GENERATION', 'Correctly detects APP_GENERATION intent');

const intent2 = contextManager.detectIntent('Cari data riset terbaru secara global');
assert(intent2 === 'GLOBAL_SEARCH', 'Correctly detects GLOBAL_SEARCH intent');

const intent3 = contextManager.detectIntent('Analisis statistik tren performa');
assert(intent3 === 'DATA_ANALYSIS', 'Correctly detects DATA_ANALYSIS intent');
console.log('');

// 5. Test Memory Adapter
console.log('TEST 5: Memory Vault Adapter');
const memory = new MemoryAdapter();
const fact = memory.addFact('Project Goal', 'Research Autonomous AI Apps', 'Blueprint');
assert(fact.key === 'Project Goal', 'Memory vault adds new knowledge items successfully');
assert(memory.getFacts().length >= 1, 'Memory vault returns stored knowledge items');
console.log('');

// 6. Test Conversation Engine
console.log('TEST 6: Conversation Engine & Payload Augmentation');
const conv = new ConversationEngine();
conv.addMessage('user', 'Halo JIN');
conv.addMessage('assistant', 'Salam! Ada yang bisa saya bantu?');
const payload = conv.buildPayload('Tolong buatkan prototype');

assert(payload.messages.length === 4, 'Payload includes System Prompt, History (2), and New Prompt (1)');
assert(payload.messages[0].role === 'system', 'First message is augmented System Prompt with context & memory');
assert(payload.messages[3].content === 'Tolong buatkan prototype', 'Last message is user prompt');
console.log('');

// 7. Test 9Router Client Fallback
console.log('TEST 7: 9Router Autonomous Synthesis Fallback');
const routerClient = new NineRouterClient();
const fallback = routerClient.generateAutonomousResponse('Halo JIN');
assert(fallback.includes('Salam! Saya JIN'), 'Autonomous synthesis generates appropriate response for JIN persona');

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
console.log('====================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
