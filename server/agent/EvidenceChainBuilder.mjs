/**
 * EvidenceChainBuilder.mjs
 * Complete adapter and re-export for EvidenceChainBuilder.
 * Ensures compatibility across AgentRuntime and all dependent subsystems.
 */

export {
  EvidenceChainBuilder,
  evidenceChainBuilderInstance,
  evidenceChainBuilderInstance as default,
  VERIFICATION_STATUS,
  SOURCE_TYPE,
  EVIDENCE_METHOD
} from './EvidenceChain.mjs';
