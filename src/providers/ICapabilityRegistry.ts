import { ProviderCapabilities } from './ProviderCapabilities';

export interface ICapabilityRegistry {
  registerCapabilities(providerId: string, capabilities: ProviderCapabilities): void;
  unregisterCapabilities(providerId: string): void;
  listCapabilities(): string[];
  findProvidersForCapability(capabilityName: string): string[];
}
