import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class LoggingStage implements IStepExecutionStage {
  readonly name = 'LoggingStage';

  async beforeExecute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext
  ): Promise<void> {
    pipelineContext.logs.push(`[LoggingStage] Starting step: ${handlerContext.step.id}`);
  }

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    return next();
  }

  async afterExecute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    result: StageResult
  ): Promise<void> {
    pipelineContext.logs.push(
      `[LoggingStage] Finished step: ${handlerContext.step.id} with status: ${result.status}`
    );
  }
}
