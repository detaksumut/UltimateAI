// src/builder/generator/ApplicationGenerator.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';
import { GeneratorPlugin } from './GeneratorFramework';
import { RenderedPrototype } from '../prototype/SimulatorRenderer';

export class ApplicationGenerator implements GeneratorPlugin {
  public name = 'ApplicationGenerator';

  /**
   * Checks if the model is approved, then generates a payload suitable for project scaffolding.
   */
  public generatePayload(model: ProjectIntelligenceModel): {
    researchSpecification: any;
    approved: boolean;
  } {
    if (!model.locked) {
      throw new Error('Cannot generate application: Project model is not approved and locked.');
    }

    // Map ProjectIntelligenceModel properties to spec object for downstream builders
    const spec = {
      researchTitle: model.researchTitle,
      researchType: model.researchType,
      methodology: model.methodology,
      variables: model.variables,
      researchObjectives: model.researchObjectives,
      researchQuestions: model.researchQuestions,
      recommendedFeatures: model.recommendedFeatures,
      recommendedParameters: model.parameters.map(p => ({
        name: p.name,
        type: p.type,
        required: p.required,
        options: p.options || []
      }))
    };

    return {
      researchSpecification: spec,
      approved: true
    };
  }

  /**
   * Conforming to GeneratorPlugin interface
   */
  public generate(model: ProjectIntelligenceModel, prototype: RenderedPrototype): Record<string, string> {
    const payload = this.generatePayload(model);
    return {
      'spec.json': JSON.stringify(payload.researchSpecification, null, 2)
    };
  }
}
