/**
 * EvidenceResolver.mjs
 * Resolves URI-like evidence references across Artifacts, Execution History, Verifier results, and Telemetry.
 * Strict Fail-Closed Property Traversal for All Domains.
 */

export class EvidenceResolver {
  /**
   * Resolves an evidence reference string to an actual evidence value
   * @param {string} evidenceRef - e.g. "artifact:brief_executive:anomaliesDetected" or "executionHistory:media.video_resolver:selectedVideo"
   * @param {Object} context - { artifact, executionHistory, verification, provenance }
   * @returns {Object} { resolved: boolean, value: any, source: string, error: string }
   */
  static resolve(evidenceRef, context = {}) {
    if (!evidenceRef || typeof evidenceRef !== 'string') {
      return { resolved: false, value: null, error: 'Invalid or empty evidence reference string' };
    }

    const parts = evidenceRef.split(':');
    const domain = parts[0];

    try {
      // 1. ARTIFACT RESOLUTION ("artifact:artifactName:property.subproperty")
      if (domain === 'artifact') {
        const artifactName = parts[1];
        const propPath = parts.slice(2).join(':');

        const activeArtifact = context.artifact;
        if (!activeArtifact) {
          return { resolved: false, value: null, error: 'No active artifact in context' };
        }

        let targetData = activeArtifact.content;
        if (propPath) {
          const props = propPath.split('.');
          for (const p of props) {
            if (targetData && targetData[p] !== undefined) {
              targetData = targetData[p];
            } else {
              return { resolved: false, value: null, error: `Property ${p} not found in artifact content` };
            }
          }
        }

        return { resolved: true, value: targetData, source: 'ARTIFACT' };
      }

      // 2. EXECUTION HISTORY RESOLUTION ("executionHistory:toolName:property")
      if (domain === 'executionHistory') {
        const toolName = parts[1];
        const propPath = parts.slice(2).join(':');

        const history = context.executionHistory || [];
        const stepMatch = history.find(h => h.step?.tool === toolName || h.step?.action === toolName);

        if (!stepMatch || !stepMatch.stepResult) {
          return { resolved: false, value: null, error: `Step with tool ${toolName} not found in execution history` };
        }

        let targetData = stepMatch.stepResult.result || stepMatch.stepResult;
        if (propPath) {
          const props = propPath.split('.');
          for (const p of props) {
            if (targetData && targetData[p] !== undefined) {
              targetData = targetData[p];
            } else {
              // Fail-closed: missing property in execution history immediately fails
              return { resolved: false, value: null, error: `Property ${p} not found in execution history result` };
            }
          }
        }

        return { resolved: true, value: targetData, source: 'EXECUTION_HISTORY' };
      }

      // 3. VERIFIER RESOLUTION ("verifier:property")
      if (domain === 'verifier') {
        const prop = parts[1];
        const verif = context.verification || {};

        if (prop === 'goal_completion_pass') {
          // Resolved = true if verification result exists; value carries the boolean outcome
          return {
            resolved: verif.isSatisfied !== undefined,
            value: Boolean(verif.isSatisfied),
            source: 'VERIFIER'
          };
        }

        if (verif[prop] !== undefined) {
          return { resolved: true, value: verif[prop], source: 'VERIFIER' };
        }
      }
    } catch (err) {
      return { resolved: false, value: null, error: `Evidence resolution exception: ${err.message}` };
    }

    return { resolved: false, value: null, error: `Unrecognized evidence domain: ${domain}` };
  }
}

export default EvidenceResolver;
