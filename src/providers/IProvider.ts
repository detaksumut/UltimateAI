import { ProviderRequest } from './types/ProviderRequest';
import { ProviderResponse } from './types/ProviderResponse';
import { ProviderContext } from './types/ProviderContext';

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  execute(
    request: ProviderRequest,
    context?: ProviderContext
  ): Promise<ProviderResponse>;
}
