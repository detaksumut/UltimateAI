/**
 * BehavioralRunner.mjs
 * Level 4.4: Isolated Black-Box Artifact Execution & Recomputation Sandbox.
 * Strictly executes the actual code produced by AgentExecutor and recomputes data models
 * against source input datasets without evaluator contamination.
 */

import vm from 'vm';

export class BehavioralRunner {
  /**
   * Black-Box Execution Sandbox for React/JSX CODE Artifacts.
   * Compiles and executes the actual component logic from artifact.content.
   * @param {Object} artifact - Artifact containing actual generated JSX code
   * @returns {Object} testReport - { passed, runtimeErrors, testCasesPassed, totalTestCases, details }
   */
  static runCodeBehavioralTests(artifact) {
    const code = String(artifact?.content || '');
    const errors = [];
    let testsPassed = 0;

    const blackBoxTestCases = [
      { investment: 100, returnVal: 150, expectedRoi: '50.00' },
      { investment: 200, returnVal: 300, expectedRoi: '50.00' },
      { investment: 100, returnVal: 80, expectedRoi: '-20.00' },
      { investment: 50, returnVal: 100, expectedRoi: '100.00' }
    ];

    try {
      // 1. Structural JSX & React Hook Parser Validation
      if (!code.includes('export default function') && !code.includes('function ResearchRoiCalculator')) {
        errors.push('Artifact missing default component declaration');
      }
      if (!code.includes('useState')) {
        errors.push('Artifact missing React interactive state hook');
      }

      // 2. Isolated VM Execution of the Artifact's Actual Calculation Function
      // Extract the calculateRoi function body directly from the artifact code
      const roiFuncMatch = code.match(/const calculateRoi = \(\) =>\s*\{([\s\S]*?)\};/);

      if (!roiFuncMatch || !roiFuncMatch[1]) {
        errors.push('Failed to locate calculateRoi execution block in artifact source');
      } else {
        const extractedBody = roiFuncMatch[1];

        // Execute in an isolated VM context with restricted sandbox
        for (const tc of blackBoxTestCases) {
          const sandbox = {
            investment: tc.investment,
            expectedReturn: tc.returnVal,
            Number: Number,
            console: { log: () => {} }
          };

          const script = new vm.Script(`
            (() => {
              ${extractedBody}
            })()
          `);

          const context = vm.createContext(sandbox);
          const actualResult = script.runInContext(context, { timeout: 500 });

          if (String(actualResult) === tc.expectedRoi) {
            testsPassed++;
          } else {
            errors.push(`Black-box evaluation failed for investment=${tc.investment}, return=${tc.returnVal}: expected ${tc.expectedRoi}%, got ${actualResult}%`);
          }
        }
      }
    } catch (err) {
      errors.push(`Artifact compilation / execution error: ${err.message}`);
    }

    const passed = errors.length === 0 && testsPassed === blackBoxTestCases.length;

    return {
      passed,
      totalTestCases: blackBoxTestCases.length,
      testsPassed,
      runtimeErrors: errors,
      evaluationType: 'BLACK_BOX_VM_EXECUTION_SANDBOX',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Recomputation & Mathematical Verification Sandbox for DATA_MODEL Artifacts.
   * Compares the artifact's claims against mathematical recomputation from input source metrics.
   * @param {Object} artifact - Artifact containing structured data model
   * @param {Object} sourceInput - Input metrics (observed: 48.0, baseline: 12.0, sectorAverage: 14.2)
   * @returns {Object} testReport
   */
  static runDataModelBehavioralTests(artifact, sourceInput = { observed: 48.0, baseline: 12.0, sectorAverage: 14.2 }) {
    const data = artifact?.content || {};
    const errors = [];
    let testsPassed = 0;

    try {
      // 1. Anomaly Discrepancy Recomputation
      const expectedAnomalyDelta = (sourceInput.observed - sourceInput.baseline).toFixed(1); // +36.0%
      const anomalies = data.anomaliesDetected || [];
      const revenueAnomaly = anomalies.find(a => a.metric.includes('Revenue Growth'));

      if (revenueAnomaly && revenueAnomaly.observed === `+${sourceInput.observed}%`) {
        testsPassed++;
      } else {
        errors.push(`Anomaly observed value does not match source data (+${sourceInput.observed}%)`);
      }

      // 2. Industry Benchmark Deviation Mathematical Recomputation
      const expectedIndustryDeviation = (sourceInput.observed - sourceInput.sectorAverage).toFixed(1); // +33.8%
      const evidence = data.industryComparisonEvidence || {};

      if (evidence.deviation && evidence.deviation.includes(`+${expectedIndustryDeviation}%`)) {
        testsPassed++;
      } else {
        errors.push(`Industry deviation recomputation mismatch: expected +${expectedIndustryDeviation}%, found ${evidence.deviation}`);
      }

      // 3. Executive Summary Presence & Grounding
      if (data.executiveSummary && data.executiveSummary.includes('anomali') && data.executiveSummary.length > 30) {
        testsPassed++;
      } else {
        errors.push('Executive summary is missing anomaly grounding or too short');
      }
    } catch (err) {
      errors.push(`Data recomputation exception: ${err.message}`);
    }

    const passed = errors.length === 0 && testsPassed === 3;

    return {
      passed,
      totalTestCases: 3,
      testsPassed,
      runtimeErrors: errors,
      evaluationType: 'SOURCE_RECOMPUTATION_SANDBOX',
      timestamp: new Date().toISOString()
    };
  }
}

export default BehavioralRunner;
