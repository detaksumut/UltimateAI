import { WorkspaceEventBus, WorkspaceEventType } from '../perception/WorkspaceEventBus';

export interface IGovernanceRule {
  id: string;
  type: 'ADR' | 'CONSTITUTION' | 'PRINCIPLE';
  description: string;
  constraints: string[];
}

/**
 * Governance Memory
 * Stores Architectural Decision Records (ADRs), Product Constitution, 
 * and Engineering Principles. Acts as the Law for Engineering Judgment.
 */
export class GovernanceMemory {
  private laws: Map<string, IGovernanceRule> = new Map();

  constructor(bus: WorkspaceEventBus) {
    bus.subscribe(WorkspaceEventType.ADR_CREATED, async (event) => {
      this.laws.set(event.payload.id, {
        id: event.payload.id,
        type: 'ADR',
        description: event.payload.description,
        constraints: event.payload.constraints || []
      });
    });
  }

  public loadConstitution(constitutionText: string): void {
    this.laws.set('CONSTITUTION', {
      id: 'CONSTITUTION',
      type: 'CONSTITUTION',
      description: 'The Ultimate Product Constitution',
      constraints: [constitutionText]
    });
  }

  public evaluateCompliance(proposedChange: string): boolean {
    // In reality, this consults the laws to ensure no violations.
    return true; // Optimistic default for scaffold
  }
}
