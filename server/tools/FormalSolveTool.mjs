/**
 * FormalSolveTool.mjs
 * Tool contract for formal.solve - Authoritative computation & constraint solver.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { formalSolverEngineInstance } from '../solver/FormalSolverEngine.mjs';

export class FormalSolveTool extends ToolContract {
  constructor() {
    super({
      name: 'formal.solve',
      version: '1.0.0',
      description: 'Authoritative formal mathematical calculator, symbolic CAS, and logic constraint solver.',
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 5000,
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['EXACT_ARITHMETIC', 'SYMBOLIC_CAS', 'CONSTRAINT_SAT'], default: 'EXACT_ARITHMETIC' },
          expression: { type: 'string' },
          constraints: { type: 'array', items: { type: 'string' } },
          variables: { type: 'object' }
        }
      }
    });
  }

  async execute(params = {}) {
    const result = await formalSolverEngineInstance.solve(params);
    return {
      status: 'SUCCESS',
      tool: 'formal.solve',
      ...result
    };
  }
}

export const formalSolveToolInstance = new FormalSolveTool();
export default formalSolveToolInstance;
