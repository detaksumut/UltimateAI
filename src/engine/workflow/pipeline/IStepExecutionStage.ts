import { PipelineContext } from '../types/PipelineContext';
import { HandlerContext } from '../types/HandlerContext';
import { StageResult } from '../types/StageResult';

export interface IStepExecutionStage {
  readonly name: string;

  /** Optional hook run before primary execute logic */
  beforeExecute?(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext
  ): Promise<void>;

  /** Mandatory core execution logic */
  execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult>;

  /** Optional hook run if execution or downstream next throws an unhandled error */
  onError?(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    error: Error
  ): Promise<StageResult>;

  /** Optional hook run after downstream next resolves */
  afterExecute?(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    result: StageResult
  ): Promise<void>;
}
