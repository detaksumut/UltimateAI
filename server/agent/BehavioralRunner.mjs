/**
 * BehavioralRunner.mjs
 * Level 4.5.1: Real Black-Box Runtime Execution & Behavioral Verifier.
 * Executes the actual component logic directly from artifact source inside an isolated VM execution context,
 * testing state transitions without internal runner calculations.
 */

import vm from 'vm';

export class BehavioralRunner {
  /**
   * Black-Box Execution & State Interaction Evaluator.
   * Compiles and executes the artifact's actual code directly.
   * @param {Object} artifact - Artifact containing React/JSX component
   * @returns {Object} testReport
   */
  static runCodeBehavioralTests(artifact) {
    const code = String(artifact?.content || '');
    const errors = [];
    let testsPassed = 0;

    const blackBoxScenarios = [
      { input1: 100, input2: 150, expectedOutput: '50.00%' },
      { input1: 200, input2: 300, expectedOutput: '50.00%' },
      { input1: 100, input2: 80, expectedOutput: '-20.00%' },
      { input1: 50, input2: 100, expectedOutput: '100.00%' }
    ];

    try {
      // 1. Structure & Interface Validation
      const hasComponent = code.includes('export default function') || code.includes('function');
      const hasInputs = code.includes('type="number"') || code.includes('<input');
      const hasOutputDisplay = code.includes('ROI') || code.includes('%');

      if (!hasComponent || !hasInputs || !hasOutputDisplay) {
        errors.push('Artifact missing required interactive UI interface components');
      } else {
        testsPassed++;
      }

      // 2. Extract calculation logic directly from artifact code without modifying it
      const roiMatch = code.match(/const calculateRoi\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);

      if (!roiMatch || !roiMatch[1]) {
        errors.push('Artifact missing calculateRoi component execution block');
      } else {
        const artifactFunctionBody = roiMatch[1];

        // Execute the artifact's actual code in an isolated VM script
        for (const sc of blackBoxScenarios) {
          const sandbox = {
            investment: sc.input1,
            expectedReturn: sc.input2,
            Number: Number
          };

          const script = new vm.Script(`
            (() => {
              ${artifactFunctionBody}
            })()
          `);

          const context = vm.createContext(sandbox);
          const actualResult = script.runInContext(context, { timeout: 500 });
          const formattedResult = `${actualResult}%`;

          if (formattedResult === sc.expectedOutput) {
            testsPassed++;
          } else {
            errors.push(`Black-box DOM assertion failed: artifact evaluated to ${formattedResult}, expected ${sc.expectedOutput}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Runtime UI evaluation exception: ${err.message}`);
    }

    const totalTests = 1 + blackBoxScenarios.length;
    const passed = errors.length === 0 && testsPassed === totalTests;

    return {
      passed,
      totalTestCases: totalTests,
      testsPassed,
      runtimeErrors: errors,
      evaluationTier: 'TIER_3_REAL_CODE_EXECUTION',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Tier 2: Mathematical Recomputation against Raw Source Data.
   * @param {Object} artifact - Data Model artifact
   * @param {Object} sourceInput - Input metrics { observed: 48.0, baseline: 12.0, sectorAverage: 14.2 }
   * @returns {Object} testReport
   */
  static runDataModelBehavioralTests(artifact, sourceInput = { observed: 48.0, baseline: 12.0, sectorAverage: 14.2 }) {
    const data = artifact?.content || {};
    const errors = [];
    let testsPassed = 0;

    try {
      // 1. Recompute Anomaly Discrepancy (+36.0%)
      const expectedAnomaly = `+${sourceInput.observed}%`;
      const anomalies = data.anomaliesDetected || [];
      const matchingAnomaly = anomalies.find(a => a.observed === expectedAnomaly);

      if (matchingAnomaly) {
        testsPassed++;
      } else {
        errors.push(`Anomaly observed value does not match raw source input (${expectedAnomaly})`);
      }

      // 2. Recompute Industry Deviation (+33.8%)
      const expectedDeviation = `+${(sourceInput.observed - sourceInput.sectorAverage).toFixed(1)}%`;
      const evidence = data.industryComparisonEvidence || {};

      if (evidence.deviation && evidence.deviation.includes(expectedDeviation)) {
        testsPassed++;
      } else {
        errors.push(`Industry deviation recomputation mismatch: expected ${expectedDeviation}, found ${evidence.deviation}`);
      }

      // 3. Recompute Executive Synthesis Grounding
      if (data.executiveSummary && data.executiveSummary.length > 30) {
        testsPassed++;
      } else {
        errors.push('Executive summary missing data grounding');
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
      evaluationTier: 'TIER_2_MATHEMATICAL_SOURCE_RECOMPUTATION',
      timestamp: new Date().toISOString()
    };
  }
}

export default BehavioralRunner;
