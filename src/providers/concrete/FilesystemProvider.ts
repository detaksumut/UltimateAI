import { IProvider } from '../IProvider';
import { ProviderRequest } from '../types/ProviderRequest';
import { ProviderResponse } from '../types/ProviderResponse';
import { ProviderContext } from '../types/ProviderContext';

export class FilesystemProvider implements IProvider {
  readonly type = 'filesystem';

  constructor(
    readonly id: string,
    readonly name: string,
    private readonly config: Record<string, any> = {}
  ) {}

  async execute(
    request: ProviderRequest,
    context?: ProviderContext
  ): Promise<ProviderResponse> {
    if (context?.cancellationSignal?.aborted) {
      return {
        success: false,
        error: { code: 'CANCELLED', message: 'Operation cancelled' }
      };
    }

    switch (request.operation.toLowerCase()) {
      case 'read': {
        const path = request.params.path || '';
        return {
          success: true,
          data: `File contents of ${path} (simulated)`,
          metadata: { sizeBytes: 1024 }
        };
      }
      case 'write': {
        const path = request.params.path || '';
        const content = request.params.content || '';
        return {
          success: true,
          data: { path, written: true },
          metadata: { contentLen: content.length }
        };
      }
      default:
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_OPERATION',
            message: `Operation ${request.operation} not supported by FilesystemProvider`
          }
        };
    }
  }
}
