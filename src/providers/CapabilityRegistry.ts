import { ICapabilityRegistry } from './ICapabilityRegistry';
import { ProviderCapabilities } from './ProviderCapabilities';

export class CapabilityRegistry implements ICapabilityRegistry {
  private readonly providerCapabilities = new Map<string, string[]>();

  registerCapabilities(providerId: string, capabilities: ProviderCapabilities): void {
    this.providerCapabilities.set(providerId, capabilities.supportedOperations);
  }

  unregisterCapabilities(providerId: string): void {
    this.providerCapabilities.delete(providerId);
  }

  listCapabilities(): string[] {
    const all = new Set<string>();
    for (const caps of this.providerCapabilities.values()) {
      for (const cap of caps) {
        all.add(cap);
      }
    }
    return Array.from(all);
  }

  findProvidersForCapability(capabilityName: string): string[] {
    const providers: string[] = [];
    for (const [providerId, caps] of this.providerCapabilities.entries()) {
      if (caps.includes(capabilityName)) {
        providers.push(providerId);
      }
    }
    return providers;
  }
}
