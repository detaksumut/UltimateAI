// src/builder/adjustment/SimulatorUpdater.ts

import { PrototypeIntelligenceEngine } from '../prototype/PrototypeIntelligenceEngine';
import type { RenderedPrototype } from '../prototype/SimulatorRenderer';
import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';

export class SimulatorUpdater {
  private prototypeEngine = new PrototypeIntelligenceEngine();

  /**
   * Refreshes the simulator rendering using the updated model.
   */
  public updateSimulator(model: ProjectIntelligenceModel): RenderedPrototype {
    return this.prototypeEngine.generatePrototype(model);
  }
}
