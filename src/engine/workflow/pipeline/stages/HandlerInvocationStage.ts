import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';
import { IStepResolver } from '../../step/IStepResolver';

export class HandlerInvocationStage implements IStepExecutionStage {
  readonly name = 'HandlerInvocationStage';

  constructor(private readonly stepResolver: IStepResolver) {}

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    try {
      const handler = this.stepResolver.resolve(handlerContext.step);
      const result = await handler.execute(handlerContext);
      if (result.ok) {
        return {
          status: 'continue',
          value: result.value
        };
      } else {
        const isRetriable = (result.error as any)?.retriable !== false;
        return {
          status: isRetriable ? 'retry' : 'abort',
          error: result.error
        };
      }
    } catch (error: any) {
      return {
        status: 'retry',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}
