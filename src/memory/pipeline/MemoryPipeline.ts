// src/memory/pipeline/MemoryPipeline.ts
import { IMemoryResolver } from "../interfaces/IMemoryResolver";
import { IMemoryProvider } from "../interfaces/IMemoryProvider";
import { MemoryRequest } from "../types/MemoryRequest";
import { MemoryResponse } from "../types/MemoryResponse";
import { MemoryProviderNotFoundError } from "../resolver/MemoryProviderNotFoundError";

/**
 * Pipeline responsible for orchestrating a memory operation flow.
 *
 * 1. Validate the request (future middleware).
 * 2. Resolve the appropriate provider via {@link IMemoryResolver}.
 * 3. Invoke the provider operation.
 * 4. Return the {@link MemoryResponse}.
 *
 * The pipeline does not contain business logic, storage handling, or provider
 * knowledge beyond the {@link IMemoryResolver} contract. It is designed to be
 * extensible – middleware can be inserted by decorating the `execute` method in
 * future versions.
 */
export class MemoryPipeline {
  private readonly resolver: IMemoryResolver;

  /**
   * Construct the pipeline with its sole dependency – a memory resolver.
   * @param resolver Resolve providers based on a {@link MemoryAddress}.
   */
  constructor(resolver: IMemoryResolver) {
    this.resolver = resolver;
  }

  /**
   * Execute a memory request through the pipeline.
   * @param request Normalised {@link MemoryRequest}.
   * @returns The provider's {@link MemoryResponse}.
   * @throws {MemoryProviderNotFoundError} When no provider matches the address.
   * @throws {Error} Propagates any error thrown by the provider.
   */
  public async execute(request: MemoryRequest): Promise<MemoryResponse> {
    // Step 1 – Validation placeholder (future middleware).
    // Currently no validation logic is required.

    // Step 2 – Resolve provider.
    const provider: IMemoryProvider = this.resolver.resolve(request.address);
    if (!provider) {
      // Defensive – resolve should throw, but guard for safety.
      throw new MemoryProviderNotFoundError(
        `Provider not found for address ${request.address.uri}`
      );
    }

    // Step 3 – Dispatch operation to the provider.
    const operation = request.operation as keyof IMemoryProvider;
    const providerMethod = provider[operation];
    if (typeof providerMethod !== "function") {
      throw new Error(`Unsupported memory operation "${String(operation)}"`);
    }

    // Provider methods may be sync or async; we await the result.
    const result = await (providerMethod as any).call(provider, request);
    return result as MemoryResponse;
  }
}
