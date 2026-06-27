// src/builder/prototype/SimulatorRenderer.ts

import { ComposedScreen } from './ScreenComposer';
import { ComposedNavigation } from './NavigationComposer';
import { UIComponent } from './ComponentComposer';

export interface RenderedPrototype {
  screens: ComposedScreen[];
  components: Record<string, UIComponent[]>;
  navigation: ComposedNavigation;
  theme: {
    primaryColor: string;
    darkMode: boolean;
    font: string;
  };
}

export class SimulatorRenderer {
  /**
   * Transforms composed items into a structured render payload.
   */
  public render(
    screens: ComposedScreen[],
    components: Record<string, UIComponent[]>,
    navigation: ComposedNavigation,
    theme: { primaryColor: string; darkMode: boolean; font: string }
  ): RenderedPrototype {
    return {
      screens,
      components,
      navigation,
      theme
    };
  }
}
