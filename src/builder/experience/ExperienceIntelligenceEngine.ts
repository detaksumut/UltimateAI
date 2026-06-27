// src/builder/experience/ExperienceIntelligenceEngine.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';

export class ExperienceIntelligenceEngine {
  /**
   * Refines screens, navigation, entry screen selection, and readiness scores to optimize user experience.
   */
  public optimizeExperience(model: ProjectIntelligenceModel): ProjectIntelligenceModel {
    // Clone model to avoid side effects
    const optimized = { ...model };

    if (!optimized.screens || optimized.screens.length === 0) {
      return optimized;
    }

    // 1. Establish Experience Hierarchy sorting values
    // Overview -> Operations -> Analysis -> Reports -> Administration -> Settings
    const HIERARCHY_MAP: Record<string, number> = {
      'dashboard': 1,
      'form': 2,
      'list': 2,
      'analysis': 3,
      'gis-map': 3,
      'report': 4,
      'reports': 4,
      'admin': 5,
      'settings': 6,
      'login': 7
    };

    const getOrder = (type: string): number => HIERARCHY_MAP[type] || 99;

    // Sort screens based on Experience Hierarchy
    const sortedScreens = [...optimized.screens].sort((a, b) => getOrder(a.type) - getOrder(b.type));

    // Reorder navigation items to match screen sorting
    let sortedNavItems = [...optimized.navigation.items];
    if (optimized.navigation && optimized.navigation.items) {
      sortedNavItems = [...optimized.navigation.items].sort((a, b) => {
        const screenA = optimized.screens.find(s => s.id === a.screenId);
        const screenB = optimized.screens.find(s => s.id === b.screenId);
        const typeA = screenA ? screenA.type : '';
        const typeB = screenB ? screenB.type : '';
        return getOrder(typeA) - getOrder(typeB);
      });
    }

    // 2. Determine Application's Entry Experience (First Screen)
    // Never begin the simulator with Authentication, Forms, Configuration, Settings, Database Tables
    // Search for dashboard/overview first.
    let entryScreen = sortedScreens.find(s => s.type === 'dashboard');
    if (!entryScreen) {
      // Find any screen that is NOT form, login, settings
      entryScreen = sortedScreens.find(s => s.type !== 'login' && s.type !== 'settings' && s.type !== 'form');
    }
    // Fallback to first sorted screen
    const entryScreenId = entryScreen ? entryScreen.id : (sortedScreens[0]?.id || 'dashboard');

    optimized.screens = sortedScreens;
    optimized.navigation = {
      ...optimized.navigation,
      items: sortedNavItems
    };
    optimized.entryScreenId = entryScreenId;

    // 3. Compute Experience Readiness Metrics
    let firstImpression = 95;
    let navigationClarity = 92;
    let taskDiscoverability = 94;
    let workflowSimplicity = 90;
    let visualHierarchy = 93;
    const contextAwareness = optimized.domain?.name !== 'Scientific Research' ? 96 : 85;
    let userConfidence = 91;

    // Rule: Never start with Form, Login, or Settings
    const startsWithBadScreen = sortedScreens[0]?.type === 'form' || sortedScreens[0]?.type === 'login' || sortedScreens[0]?.type === 'settings';
    if (startsWithBadScreen) {
      firstImpression -= 35;
      navigationClarity -= 15;
    }

    // Rule: Task Discoverability is higher if quick actions exist in screens
    const hasDashboard = sortedScreens.some(s => s.type === 'dashboard');
    if (!hasDashboard) {
      taskDiscoverability -= 25;
      workflowSimplicity -= 15;
    }

    // Rule: User confidence is lower if there are cross-domain conflicts (overall project readiness is low)
    if (optimized.projectReadiness && optimized.projectReadiness.overallReadiness < 80) {
      userConfidence -= 35;
      workflowSimplicity -= 20;
    }

    const overallExperienceReadiness = Math.round(
      (firstImpression + navigationClarity + taskDiscoverability + workflowSimplicity + visualHierarchy + contextAwareness + userConfidence) / 7
    );

    optimized.experienceReadiness = {
      firstImpression,
      navigationClarity,
      taskDiscoverability,
      workflowSimplicity,
      visualHierarchy,
      contextAwareness,
      userConfidence,
      overallExperienceReadiness
    };

    // 4. Generate Experience Recommendations
    const experienceRecommendations: string[] = [];
    if (sortedScreens.some(s => s.type === 'report') && sortedScreens.some(s => s.type === 'analysis')) {
      experienceRecommendations.push("I recommend moving Reports below Analytics because users typically analyze data before exporting.");
    }
    if (sortedScreens.some(s => s.type === 'login')) {
      experienceRecommendations.push("I recommend replacing the login screen with a dashboard preview during prototyping.");
    }
    if (hasDashboard) {
      experienceRecommendations.push("I recommend displaying current project statistics on the home screen.");
      experienceRecommendations.push("I recommend adding a Quick Action section because the primary user repeatedly performs data collection.");
    }

    optimized.experienceRecommendations = experienceRecommendations;

    return optimized;
  }
}
