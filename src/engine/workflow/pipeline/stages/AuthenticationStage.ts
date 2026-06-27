import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class AuthenticationStage implements IStepExecutionStage {
  readonly name = 'AuthenticationStage';

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    const permissions = handlerContext.definition.permissions ?? [];
    const userRole = handlerContext.metadata?.userRole as string | undefined;

    if (permissions.includes('admin') && userRole !== 'admin') {
      return {
        status: 'abort',
        error: new Error('Authentication failed: admin role required')
      };
    }

    if (handlerContext.metadata?.blocked === true) {
      return {
        status: 'abort',
        error: new Error('Authentication failed: user is blocked')
      };
    }

    return next();
  }
}
