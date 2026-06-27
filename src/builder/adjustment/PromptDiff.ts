// src/builder/adjustment/PromptDiff.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';
import { DetectedChange } from './ChangeDetector';

export class PromptDiff {
  /**
   * Applies detected changes to the ProjectIntelligenceModel to create an updated model.
   */
  public applyDiff(model: ProjectIntelligenceModel, changes: DetectedChange[]): ProjectIntelligenceModel {
    // Clone model to ensure immutability
    const updated = JSON.parse(JSON.stringify(model)) as ProjectIntelligenceModel;

    for (const change of changes) {
      switch (change.actionType) {
        case 'add_screen':
          if (change.target === 'login' && !updated.screens.some(s => s.id === 'login')) {
            updated.screens.unshift({
              id: 'login',
              title: 'Login Page',
              type: 'login',
              components: ['LoginFormInput', 'SubmitButton']
            });
            if (!updated.navigation.items.some(item => item.screenId === 'login')) {
              updated.navigation.items.unshift({
                label: 'Login',
                screenId: 'login',
                icon: 'Lock'
              });
            }
          }
          if (change.target === 'gis-map' && !updated.screens.some(s => s.id === 'gis-map')) {
            updated.screens.push({
              id: 'gis-map',
              title: 'GIS Map',
              type: 'gis-map',
              components: ['GISMapCard', 'MapWidget']
            });
            if (!updated.navigation.items.some(item => item.screenId === 'gis-map')) {
              updated.navigation.items.push({
                label: 'GIS Map',
                screenId: 'gis-map',
                icon: 'Globe'
              });
            }
          }
          break;
        case 'change_theme':
          if (change.target === 'primaryColor') {
            updated.theme.primaryColor = change.value;
          } else if (change.target === 'darkMode') {
            updated.theme.darkMode = change.value;
          }
          break;
        case 'change_navigation':
          if (change.target === 'type') {
            updated.navigation.type = change.value;
          }
          break;
        case 'add_parameter':
          if (!updated.parameters.some(p => p.name.toLowerCase() === change.target.toLowerCase())) {
            updated.parameters.push({
              name: change.target,
              type: change.value.type,
              required: change.value.required
            });
          }
          break;
        case 'remove_parameter':
          updated.parameters = updated.parameters.filter(
            p => p.name.toLowerCase() !== change.target.toLowerCase()
          );
          break;
        default:
          // Add custom general parameter
          if (!updated.parameters.some(p => p.name.toLowerCase() === 'custom parameter')) {
            updated.parameters.push({
              name: 'Custom Parameter',
              type: 'text',
              required: false
            });
          }
          break;
      }
    }

    return updated;
  }
}
