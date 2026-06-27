// src/builder/generator/GeneratorFramework.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';
import { RenderedPrototype } from '../prototype/SimulatorRenderer';

export interface GeneratorPlugin {
  name: string;
  generate(model: ProjectIntelligenceModel, prototype: RenderedPrototype): Record<string, string>;
}

export class GeneratorFramework {
  private plugins: GeneratorPlugin[] = [];

  public registerPlugin(plugin: GeneratorPlugin): void {
    this.plugins.push(plugin);
  }

  public generateAll(model: ProjectIntelligenceModel, prototype: RenderedPrototype): Record<string, string> {
    const combinedFiles: Record<string, string> = {};
    for (const plugin of this.plugins) {
      const files = plugin.generate(model, prototype);
      Object.assign(combinedFiles, files);
    }
    return combinedFiles;
  }
}
