import { IRuntimeCoordinator } from "../../runtime/coordinator/RuntimeCoordinator";
import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";
import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";
import { IRuntimeResult } from "../../runtime/contracts/IRuntimeResult";
import { RuntimePolicy, DEFAULT_RUNTIME_POLICY } from "../../runtime/policies/RuntimePolicy";
import { CircuitBreakerRegistry, CircuitOpenException } from "../registry/CircuitBreakerRegistry";
import { FailureClassifier } from "../classification/FailureClassifier";
import { RetryPolicy, DEFAULT_RETRY_POLICY } from "../policies/RetryPolicy";
import { CheckpointManager } from "../checkpoint/CheckpointManager";
import { IRuntimeResolver } from "../../runtime/resolver/RuntimeResolver";
import { ExecutionCheckpoint } from "../checkpoint/ExecutionCheckpoint";

export class ReliabilityInterceptor implements IRuntimeCoordinator {
  constructor(
    private readonly innerCoordinator: IRuntimeCoordinator,
    private readonly circuitBreaker: CircuitBreakerRegistry,
    private readonly checkpointManager: CheckpointManager,
    private readonly resolver: IRuntimeResolver, // Need resolver to know runtimeId for checkpointing before execution
    private readonly retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
  ) {}

  async executeCapability(
    capability: RuntimeCapability, 
    context: IRuntimeContext, 
    policy: RuntimePolicy = DEFAULT_RUNTIME_POLICY
  ): Promise<IRuntimeResult> {
    
    // Resolve runtime to get its ID for checking checkpoints
    const runtime = this.resolver.resolve(capability);
    const runtimeId = runtime.manifest.id;

    // Fast-Forward / Resume Logic: Skip if already succeeded
    const history = this.checkpointManager.getHistory(context.trace.traceId);
    const successfulCheckpoint = history.find(c => c.runtimeId === runtimeId && c.phase === "AFTER");
    if (successfulCheckpoint && successfulCheckpoint.resultPayload) {
      console.log(`[ResumeEngine] Bypassing ${runtimeId}, recovering from checkpoint ${successfulCheckpoint.checkpointId}`);
      return successfulCheckpoint.resultPayload as IRuntimeResult;
    }

    if (this.circuitBreaker.isOpen(runtimeId)) {
      throw new CircuitOpenException(runtimeId);
    }

    let attempt = 0;
    let delay = this.retryPolicy.initialBackoffMs;

    while (attempt <= this.retryPolicy.maxRetries) {
      try {
        // We defer to the inner coordinator for actual execution and telemetry emission
        const result = await this.innerCoordinator.executeCapability(capability, context, policy);
        this.circuitBreaker.recordSuccess(runtimeId);
        
        // Write Checkpoint
        const checkpoint: ExecutionCheckpoint = {
          checkpointId: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          traceId: context.trace.traceId,
          sequenceNumber: history.length + 1,
          runtimeId: runtimeId,
          phase: "AFTER",
          artifactIds: [], // We could extract from payload
          timestamp: Date.now(),
          contextSnapshot: JSON.parse(JSON.stringify(context)),
          resultPayload: result
        };
        this.checkpointManager.save(checkpoint);

        return result;
      } catch (error: any) {
        this.circuitBreaker.recordFailure(runtimeId);
        
        const classification = FailureClassifier.classify(error);
        
        if (!classification.retryable || attempt >= this.retryPolicy.maxRetries) {
          throw error; // Permanent failure or max retries reached
        }

        attempt++;
        const backoffMs = classification.suggestedDelayMs > 0 ? classification.suggestedDelayMs : delay;
        
        console.warn(`[Reliability] Transient failure for ${runtimeId} (Attempt ${attempt}). Retrying in ${backoffMs}ms...`);
        
        await new Promise(r => setTimeout(r, backoffMs));
        
        // Exponential backoff
        delay = Math.min(delay * 2, this.retryPolicy.maxBackoffMs);
      }
    }

    throw new Error("Unreachable");
  }
}
