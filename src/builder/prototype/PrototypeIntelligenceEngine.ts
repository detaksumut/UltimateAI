// src/builder/prototype/PrototypeIntelligenceEngine.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';
import { ScreenComposer, ComposedScreen } from './ScreenComposer';
import { ComponentComposer, UIComponent } from './ComponentComposer';
import { NavigationComposer, ComposedNavigation } from './NavigationComposer';
import { SimulatorRenderer, RenderedPrototype } from './SimulatorRenderer';
import { ExperienceIntelligenceEngine } from '../experience/ExperienceIntelligenceEngine';
import { ProjectContextIsolationEngine } from '../context/ProjectContextIsolationEngine';
import { ContextIntegrityEngine } from '../context/ContextIntegrityEngine';

export class PrototypeIntelligenceEngine {
  private experienceEngine = new ExperienceIntelligenceEngine();
  private screenComposer = new ScreenComposer();
  private componentComposer = new ComponentComposer();
  private navigationComposer = new NavigationComposer();
  private simulatorRenderer = new SimulatorRenderer();

  /**
   * Generates a complete user journey visual simulation state from the ProjectIntelligenceModel.
   */
  public generatePrototype(model: ProjectIntelligenceModel): RenderedPrototype {
    // 1. Enforce Context Lock before prototype generation starts
    const isolationEngine = new ProjectContextIsolationEngine();
    const lockedModel = isolationEngine.lockContext(model);

    // 2. Enforce Context Integrity check and automatic sanitization
    const integrityEngine = new ContextIntegrityEngine();
    const sanitizedModel = integrityEngine.sanitize(lockedModel);

    // 3. Run Experience Intelligence optimization to enforce user-centric sorting & metrics
    const optimizedModel = this.experienceEngine.optimizeExperience(sanitizedModel);

    // 4. Journey & Screen composition
    const screens = this.screenComposer.composeScreens(optimizedModel.screens, optimizedModel.theme.primaryColor);

    // 5. Dynamic Component & KPI layout composition for each screen
    const components: Record<string, UIComponent[]> = {};
    for (const screen of optimizedModel.screens) {
      components[screen.id] = this.componentComposer.composeComponentsForScreen(
        screen.id,
        screen.type,
        optimizedModel.parameters,
        optimizedModel
      );
    }

    // 6. Dynamic Navigation link structure
    const navigation = this.navigationComposer.composeNavigation(
      optimizedModel.navigation.type,
      optimizedModel.navigation.items
    );

    // 7. Render output Simulation State
    return this.simulatorRenderer.render(screens, components, navigation, optimizedModel.theme);
  }
}
