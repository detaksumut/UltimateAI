import { GovernanceMemory } from '../memory/GovernanceMemory';
import { ChangePlan } from '../planner/EngineeringPlanner';

export interface JudgmentResult {
  approved: boolean;
  violations: string[];
  suggestions: string[];
}

/**
 * Engineering Judgment
 * The ultimate filter. Evaluates the Change Plan against the Product Constitution
 * and ADRs. Prevents the Reasoner (LLM) from generating non-compliant code.
 */
export class EngineeringJudgment {
  private governance: GovernanceMemory;

  constructor(governance: GovernanceMemory) {
    this.governance = governance;
  }

  public evaluatePlan(plan: ChangePlan): JudgmentResult {
    const violations: string[] = [];
    
    // Example: Check if the plan touches core engine modules unexpectedly
    if (plan.affectedModules.includes('Engine') || plan.affectedModules.includes('Runtime')) {
      const isApproved = this.governance.evaluateCompliance('engine_modification');
      if (!isApproved) {
        violations.push('Plan violates Constitution: Product changes must not modify the Engine.');
      }
    }

    return {
      approved: violations.length === 0,
      violations,
      suggestions: violations.length > 0 ? ['Rethink the architecture to avoid modifying the EAEP core.'] : []
    };
  }
}
