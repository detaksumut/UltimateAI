import { WorkspaceEventBus } from '../perception/WorkspaceEventBus';

export interface ICapabilityNode {
  id: string;
  businessFeature: string;
  subCapabilities: string[]; // Workflow steps
}

/**
 * Procedural Memory
 * Stores Workflows, Capabilities, and Business Logic flows.
 * E.g., Membership -> Registration -> Verification.
 */
export class ProceduralMemory {
  private capabilities: Map<string, ICapabilityNode> = new Map();

  constructor(bus: WorkspaceEventBus) {
    // Listen to workflow/manifest updates
  }

  public registerCapability(capability: ICapabilityNode): void {
    this.capabilities.set(capability.id, capability);
  }

  public getCapabilityFlow(id: string): ICapabilityNode | undefined {
    return this.capabilities.get(id);
  }
}
