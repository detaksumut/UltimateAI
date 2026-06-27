import { IStepExecutionStage } from '../IStepExecutionStage';
import { PipelineContext } from '../../types/PipelineContext';
import { HandlerContext } from '../../types/HandlerContext';
import { StageResult } from '../../types/StageResult';

export class CapabilityValidationStage implements IStepExecutionStage {
  readonly name = 'CapabilityValidationStage';

  constructor(private readonly availableCapabilities: string[] = []) {}

  async execute(
    pipelineContext: PipelineContext,
    handlerContext: HandlerContext,
    next: () => Promise<StageResult>
  ): Promise<StageResult> {
    const required = handlerContext.definition.requiredCapabilities ?? [];
    for (const cap of required) {
      if (!this.availableCapabilities.includes(cap)) {
        return {
          status: 'abort',
          error: new Error(`CapabilityValidationStage: Required capability ${cap} is not available`)
        };
      }
    }
    return next();
  }
}
