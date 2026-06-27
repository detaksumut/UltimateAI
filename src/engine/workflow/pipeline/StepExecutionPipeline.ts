import { IStepExecutionStage } from './IStepExecutionStage';
import { PipelineContext } from '../types/PipelineContext';
import { HandlerContext } from '../types/HandlerContext';
import { StageResult } from '../types/StageResult';
import { Result, ok, err } from '../../core/types/Result';

export class StepExecutionPipeline {
  constructor(private readonly stages: IStepExecutionStage[]) {}

  async execute(
    handlerContext: HandlerContext
  ): Promise<Result<any, Error>> {
    const pipelineContext: PipelineContext = {
      state: {},
      logs: [],
      metrics: {},
      retryCount: 0
    };

    const runStage = async (index: number): Promise<StageResult> => {
      if (index >= this.stages.length) {
        return { status: 'continue' };
      }
      const stage = this.stages[index];

      if (stage.beforeExecute) {
        await stage.beforeExecute(pipelineContext, handlerContext);
      }

      let result: StageResult;
      try {
        result = await stage.execute(pipelineContext, handlerContext, () => runStage(index + 1));
      } catch (error: any) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        if (stage.onError) {
          result = await stage.onError(pipelineContext, handlerContext, errorObj);
        } else {
          throw errorObj;
        }
      }

      if (stage.afterExecute) {
        await stage.afterExecute(pipelineContext, handlerContext, result);
      }

      return result;
    };

    try {
      const finalResult = await runStage(0);
      if (finalResult.status === 'abort') {
        return err(
          finalResult.error instanceof Error
            ? finalResult.error
            : new Error(String(finalResult.error || 'Execution aborted'))
        );
      }
      if (finalResult.status === 'retry') {
        return err(
          finalResult.error instanceof Error
            ? finalResult.error
            : new Error(String(finalResult.error || 'Execution failed after retries'))
        );
      }
      return ok(finalResult.value);
    } catch (error: any) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
