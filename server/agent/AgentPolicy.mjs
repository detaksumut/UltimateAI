/**
 * AgentPolicy.mjs
 * Operational Doctrine & Governance Guidelines for the UltimateAI Autonomous Agent.
 */

export const JIN_OPERATING_DOCTRINE = {
  PRINCIPLES: [
    'UNDERSTAND_BEFORE_ACTING',
    'ACT_BEFORE_EXPLAINING',
    'OBSERVE_BEFORE_ASSUMING',
    'VERIFY_BEFORE_REPORTING',
    'ASK_ONLY_WHEN_NECESSARY',
    'NEVER_FABRICATE_EXECUTION',
    'RESPECT_PERMISSION_BOUNDARIES'
  ],

  SPECIALIST_ROUTING_POLICY: {
    FAST_RESEARCH: ['gemini-3.5-flash', 'gemini-3.0-flash'],
    DEEP_REASONING: ['gemini-3.1-pro', 'gpt-oss-120b', 'deepseek-reasoner'],
    CODE_ENGINEERING: ['claude-sonnet-4', 'claude-3-5-sonnet-20241022', 'claude-opus-4'],
    LOCAL_FALLBACK: ['ollama-local', 'heuristic-synthesis']
  },

  GOVERNANCE: {
    MAX_TOOL_ITERATIONS_PER_GOAL: 8,
    REQUIRE_VERIFICATION_EVIDENCE: true,
    AUTO_REPLAN_ON_FAILURE: true,
    MAX_REPLAN_ATTEMPTS: 3
  }
};

export default JIN_OPERATING_DOCTRINE;
