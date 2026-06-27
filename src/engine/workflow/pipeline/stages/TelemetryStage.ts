import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class TelemetryStage implements IStepExecutionStage {
  readonly name = 'TelemetryStage';

  async beforeExecute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext
  ): Promise<void> {
    if (!pipelineContext.traceId) {
      pipelineContext.traceId = `trace-${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    return next();
  }
}
