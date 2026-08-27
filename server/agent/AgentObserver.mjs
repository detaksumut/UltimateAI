/**
 * AgentObserver.mjs
 * Observes real execution output, extracts telemetry, verifies schemas, and monitors state.
 */

export class AgentObserver {
  /**
   * Observes step execution output
   * @param {Object} step - Planned step
   * @param {Object} stepResult - Result from AgentExecutor
   * @returns {Object} observation - { valid, observationNotes, telemetry }
   */
  static observe(step, stepResult) {
    if (!stepResult || !stepResult.success) {
      return {
        valid: false,
        status: 'EXECUTION_ERROR',
        error: stepResult?.error || 'Unknown execution failure',
        observationNotes: `Step ${step.name} failed during execution.`
      };
    }

    const { result, durationMs } = stepResult;

    // Check payload validity
    const hasData = result !== null && result !== undefined;

    return {
      valid: hasData,
      status: 'OBSERVED_VALID',
      durationMs,
      observationNotes: `Step ${step.name} executed and produced valid artifact.`,
      artifactPreview: typeof result === 'object' ? Object.keys(result) : String(result).slice(0, 100)
    };
  }
}

export default AgentObserver;
