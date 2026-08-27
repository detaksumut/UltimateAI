import { WorkspaceEventBus } from './perception/WorkspaceEventBus';
import { PerceptionEngine } from './perception/PerceptionEngine';
import { SemanticMemory } from './memory/SemanticMemory';
import { StructuralMemory } from './memory/StructuralMemory';
import { ProceduralMemory } from './memory/ProceduralMemory';
import { GovernanceMemory } from './memory/GovernanceMemory';
import { EngineeringPlanner, ChangePlan } from './planner/EngineeringPlanner';
import { EngineeringJudgment, JudgmentResult } from './judgment/EngineeringJudgment';

/**
 * Engineering Cognitive Runtime (ECR)
 * The ultimate orchestrator of the cognitive pipeline:
 * Perception -> Memory -> Planning -> Judgment -> Reasoning (LLM)
 */
export class EngineeringCognitiveRuntime {
  public bus: WorkspaceEventBus;
  public perception: PerceptionEngine;
  
  // Cognitive Memory Systems
  public memory: {
    semantic: SemanticMemory;
    structural: StructuralMemory;
    procedural: ProceduralMemory;
    governance: GovernanceMemory;
  };

  public planner: EngineeringPlanner;
  public judgment: EngineeringJudgment;

  constructor() {
    this.bus = new WorkspaceEventBus();
    this.perception = new PerceptionEngine(this.bus);

    this.memory = {
      semantic: new SemanticMemory(this.bus),
      structural: new StructuralMemory(this.bus),
      procedural: new ProceduralMemory(this.bus),
      governance: new GovernanceMemory(this.bus)
    };

    this.planner = new EngineeringPlanner(
      this.memory.semantic,
      this.memory.structural,
      this.memory.procedural
    );

    this.judgment = new EngineeringJudgment(this.memory.governance);
  }

  /**
   * The Entry Point for a new Engineering Task.
   * Note: The LLM is NOT called here. This function returns the validated 
   * Change Plan, which the Reasoner (LLM) will subsequently use to generate code.
   */
  public async processEngineeringRequest(featureRequest: string): Promise<{ plan: ChangePlan, judgment: JudgmentResult }> {
    // 1. Perception and Memory are already synced via Event Bus
    
    // 2. Planning: Synthesize context into an Impact-Aware Change Plan
    const plan = await this.planner.generateChangePlan(featureRequest);
    
    // 3. Judgment: Evaluate the plan against Architectural Governance
    const judgment = this.judgment.evaluatePlan(plan);
    
    if (!judgment.approved) {
      throw new Error(`Plan rejected by Engineering Judgment: ${judgment.violations.join(', ')}`);
    }

    return { plan, judgment };
  }
}
