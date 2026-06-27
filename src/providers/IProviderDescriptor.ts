import { ProviderCapabilities } from './ProviderCapabilities';

export interface IProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly capabilities: ProviderCapabilities;
  readonly isHealthy: boolean;
}
