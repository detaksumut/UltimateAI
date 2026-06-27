import { IProvider } from '../IProvider';
import { ProviderRequest } from '../types/ProviderRequest';
import { ProviderResponse } from '../types/ProviderResponse';
import { ProviderContext } from '../types/ProviderContext';

export class OpenAIProvider implements IProvider {
  readonly type = 'llm';

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
      case 'chat': {
        const prompt = request.params.prompt || '';
        if (!prompt) {
          return {
            success: false,
            error: { code: 'INVALID_PARAMS', message: 'Prompt is required' }
          };
        }
        return {
          success: true,
          data: `OpenAI simulated response for prompt: "${prompt}"`,
          metadata: { model: this.config.model || 'gpt-4', latencyMs: 5 }
        };
      }
      case 'embedding': {
        const text = request.params.text || '';
        return {
          success: true,
          data: [0.1, 0.2, 0.3],
          metadata: { textLength: text.length }
        };
      }
      default:
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_OPERATION',
            message: `Operation ${request.operation} not supported by OpenAIProvider`
          }
        };
    }
  }
}
