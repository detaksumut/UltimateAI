// src/builder/adjustment/AdjustmentEngine.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';
import { ChangeDetector } from './ChangeDetector';
import { PromptDiff } from './PromptDiff';
import { SimulatorUpdater } from './SimulatorUpdater';
import type { RenderedPrototype } from '../prototype/SimulatorRenderer';

export class AdjustmentEngine {
  private changeDetector = new ChangeDetector();
  private promptDiff = new PromptDiff();
  private simulatorUpdater = new SimulatorUpdater();

  /**
   * Refines the project model based on a prompt and returns both the updated model and refreshed simulator rendering.
   */
  public adjust(
    model: ProjectIntelligenceModel,
    adjustmentPrompt: string
  ): {
    updatedModel: ProjectIntelligenceModel;
    renderedPrototype: RenderedPrototype;
  } {
    // 1. Detect what changes are requested
    const changes = this.changeDetector.detectChanges(adjustmentPrompt);

    // 2. Apply changes to model
    const updatedModel = this.promptDiff.applyDiff(model, changes);

    // 3. Render updated simulator layout
    const renderedPrototype = this.simulatorUpdater.updateSimulator(updatedModel);

    return {
      updatedModel,
      renderedPrototype
    };
  }
}
