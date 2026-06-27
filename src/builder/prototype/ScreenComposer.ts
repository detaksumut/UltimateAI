// src/builder/prototype/ScreenComposer.ts

import { Screen } from '../requirement/ModulePlanner';

export interface ComposedScreen {
  id: string;
  title: string;
  type: string;
  headerColor: string;
  components: string[];
}

export class ScreenComposer {
  /**
   * Composes screens with visual options like headerColor.
   */
  public composeScreens(screens: Screen[], primaryColor: string): ComposedScreen[] {
    return screens.map(s => ({
      id: s.id,
      title: s.title,
      type: s.type,
      headerColor: primaryColor,
      components: s.components
    }));
  }
}
