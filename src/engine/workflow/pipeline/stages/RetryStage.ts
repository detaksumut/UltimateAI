import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class RetryStage implements IStepExecutionStage {
  readonly name = 'RetryStage';

  constructor(
    private readonly maxAttempts: number = 3,
    private readonly delayMs: number = 0
  ) {}

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    let attempts = 0;
    while (true) {
      try {
        const result = await next();
        if (result.status !== 'retry' || attempts >= this.maxAttempts - 1) {
          return result;
        }
        attempts++;
        pipelineContext.retryCount = attempts;
        if (this.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
      } catch (error: any) {
        attempts++;
        pipelineContext.retryCount = attempts;
        if (attempts >= this.maxAttempts) {
          return {
            status: 'abort',
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
        if (this.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
      }
    }
  }
}
