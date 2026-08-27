/**
 * CanonicalVocabulary.mjs
 * Single Source of Truth for UltimateAI 9Router + JIN Certification Terminology.
 * Prevents Semantic Drift across Server, UI, Telemetry, CLI, and Forensic Evidence Bundles.
 */

// 1. PROVIDER STATUS VOCABULARY
export const PROVIDER_STATUS = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',               // Key is missing or empty
  CONFIGURED_UNVERIFIED: 'CONFIGURED_UNVERIFIED', // Key present, pending handshake test
  AUTHENTICATED_LIVE: 'AUTHENTICATED_LIVE',       // Upstream handshake success (HTTP 200)
  DEGRADED: 'DEGRADED',                           // High latency (>3000ms) or rate-limit warnings
  FAILED: 'FAILED'                                // Auth rejected (401/403) or unreachable
};

// 2. RUNTIME CERTIFICATION STATUS VOCABULARY
export const RUNTIME_CERTIFICATION = {
  NOT_TESTED: 'NOT_TESTED',                       // Component not yet probed
  HARNESS_VERIFIED: 'HARNESS_VERIFIED',           // Verified in automated harness/stress test
  LIVE_NETWORK_VERIFIED: 'LIVE_NETWORK_VERIFIED', // Verified with live network queries (e.g. WebSearch)
  HOST_RUNTIME_VERIFIED: 'HOST_RUNTIME_VERIFIED', // Verified on active host runtime gateway
  REAL_WORLD_VERIFIED: 'REAL_WORLD_VERIFIED',     // Verified with real host devices, coherent session & physical human input
  FAILED: 'FAILED'                                // Runtime execution failed
};

// 3. FINAL VERDICT VOCABULARY
export const FINAL_VERDICT = {
  NOT_CERTIFIED: 'NOT_CERTIFIED',
  CONDITIONAL_CERTIFIED: 'CONDITIONAL_CERTIFIED', // Architecture & Harness Verified, Host Evidence Pending
  CERTIFICATION_PENDING: 'CERTIFICATION_PENDING', // Host empirical session in progress or incomplete
  PRODUCTION_CERTIFIED: 'PRODUCTION_CERTIFIED',   // 100% Real-World Verified across all mandatory pillars
  CERTIFICATION_FAILED: 'CERTIFICATION_FAILED'
};

// 4. STREAM MODE VOCABULARY
export const STREAM_MODE = {
  UPSTREAM_NATIVE: 'UPSTREAM_NATIVE',             // Live tokens streamed directly from Cloud LLM
  LOCAL_SYNTHETIC: 'LOCAL_SYNTHETIC'              // Transparent local synthesis engine
};

export default {
  PROVIDER_STATUS,
  RUNTIME_CERTIFICATION,
  FINAL_VERDICT,
  STREAM_MODE
};
