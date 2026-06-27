// src/builder/prototype/NavigationComposer.ts

export interface NavigationLink {
  label: string;
  screenId: string;
  icon: string;
}

export interface ComposedNavigation {
  type: 'tabs' | 'sidebar';
  links: NavigationLink[];
}

export class NavigationComposer {
  /**
   * Structures navigation elements.
   */
  public composeNavigation(type: 'tabs' | 'sidebar', items: NavigationLink[]): ComposedNavigation {
    return {
      type,
      links: items
    };
  }
}
