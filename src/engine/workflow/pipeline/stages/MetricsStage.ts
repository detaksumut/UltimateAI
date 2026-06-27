import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class MetricsStage implements IStepExecutionStage {
  readonly name = 'MetricsStage';

  async beforeExecute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext
  ): Promise<void> {
    pipelineContext.startTime = new Date();
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
    pipelineContext.endTime = new Date();
    if (pipelineContext.startTime) {
      const durationMs = pipelineContext.endTime.getTime() - pipelineContext.startTime.getTime();
      pipelineContext.durationMs = durationMs;
      pipelineContext.metrics['durationMs'] = durationMs;
    }
  }
}
