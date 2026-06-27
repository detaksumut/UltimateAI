import { IProviderRouter } from './IProviderRouter';
import { IProvider } from './IProvider';
import { ICapabilityRegistry } from './ICapabilityRegistry';
import { IProviderRegistry } from './IProviderRegistry';

export class ProviderRouter implements IProviderRouter {
  constructor(
    private readonly capabilityRegistry: ICapabilityRegistry,
    private readonly providerRegistry: IProviderRegistry
  ) {}

  route(capability: string): IProvider {
    const providerIds = this.capabilityRegistry.findProvidersForCapability(capability);
    if (providerIds.length === 0) {
      throw new Error(`No providers found for capability: ${capability}`);
    }

    // Try to find the first healthy provider
    for (const providerId of providerIds) {
      const descriptor = this.providerRegistry.getDescriptor(providerId);
      if (descriptor && descriptor.isHealthy) {
        const provider = this.providerRegistry.get(providerId);
        if (provider) {
          return provider;
        }
      }
    }

    // Fall back to first provider instance regardless of health flag
    const firstProvider = this.providerRegistry.get(providerIds[0]);
    if (firstProvider) {
      return firstProvider;
    }

    throw new Error(`Provider instance not found in registry for capability: ${capability}`);
  }
}
