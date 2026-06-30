import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";

export interface ResourceSlot {
  capability: RuntimeCapability;
  provider: string; // e.g. "OpenAI", "Gemini"
  workerId: string; // e.g. "local-worker-1"
}

export class ResourceManager {
  // Mapping of Capability -> Current Active Count
  // In a distributed setup, this will become Capability -> Provider -> Worker -> Slots
  private activeCounts = new Map<RuntimeCapability, number>();
  
  // Capacity limits per capability
  private limits = new Map<RuntimeCapability, number>();

  constructor() {
    // Default mock limits for simulation
    this.limits.set(RuntimeCapability.PLANNING, 2);
    this.limits.set(RuntimeCapability.REASONING, 5);
    this.limits.set(RuntimeCapability.EXECUTION, 10);
    this.limits.set(RuntimeCapability.KNOWLEDGE, 3);
    this.limits.set(RuntimeCapability.LEARNING, 2);
    this.limits.set(RuntimeCapability.EVOLUTION, 2);
    this.limits.set(RuntimeCapability.DELIVERY, 5);
  }

  setLimit(capability: RuntimeCapability, limit: number) {
    this.limits.set(capability, limit);
  }

  hasAvailableSlot(capability: RuntimeCapability): boolean {
    const current = this.activeCounts.get(capability) || 0;
    const limit = this.limits.get(capability) || 1; // Default to 1 if unspecified
    return current < limit;
  }

  allocate(capability: RuntimeCapability): ResourceSlot {
    if (!this.hasAvailableSlot(capability)) {
      throw new Error(`Cannot allocate resource for ${capability}. Slots exhausted.`);
    }

    const current = this.activeCounts.get(capability) || 0;
    this.activeCounts.set(capability, current + 1);

    return {
      capability,
      provider: "DefaultProvider", // Placeholder for future expansion
      workerId: "local-node" // Placeholder for future expansion
    };
  }

  release(slot: ResourceSlot): void {
    const current = this.activeCounts.get(slot.capability) || 0;
    if (current > 0) {
      this.activeCounts.set(slot.capability, current - 1);
    }
  }

  getActiveCount(capability: RuntimeCapability): number {
    return this.activeCounts.get(capability) || 0;
  }
}
