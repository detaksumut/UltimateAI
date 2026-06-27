// src/builder/requirement/ModulePlanner.ts

export interface Screen {
  id: string;
  title: string;
  type: 'dashboard' | 'form' | 'list' | 'detail' | 'report' | 'settings' | 'login' | 'map' | 'gis-map' | 'analysis';
  components: string[];
}

export class ModulePlanner {
  /**
   * Plans the screens and navigation based on the research theme dynamically.
   */
  public planModules(prompt: string, hasAuth = false): {
    screens: Screen[];
    navigation: {
      type: 'tabs' | 'sidebar';
      items: { label: string; screenId: string; icon: string }[];
    };
  } {
    const screens: Screen[] = [];
    const navigationItems: { label: string; screenId: string; icon: string }[] = [];
    const lower = prompt.toLowerCase();

    // 1. Detect dynamic requirements
    const isGIS = lower.includes('gis') || lower.includes('map') || lower.includes('peta') || lower.includes('spatial') || lower.includes('location');
    const isAnalysis = lower.includes('regression') || lower.includes('correlation') || lower.includes('anova') || lower.includes('statistics') || lower.includes('analysis');
    const isLogin = hasAuth || lower.includes('auth') || lower.includes('login') || lower.includes('secure');

    // 2. Build Modules
    const plannedModules = [];

    if (isLogin) {
      plannedModules.push({ name: 'Authentication', id: 'login', type: 'login', comps: ['LoginForm', 'SocialLoginButtons'] });
    }

    plannedModules.push({ name: 'Dashboard', id: 'dashboard', type: 'dashboard', comps: ['SummaryCards', 'TrendChart'] });
    plannedModules.push({ name: 'Data Entry', id: 'data-form', type: 'form', comps: ['ObservationFormEditor', 'SubmitButton'] });
    plannedModules.push({ name: 'Observations Grid', id: 'data-list', type: 'list', comps: ['ObservationsTable', 'SearchFilterBar', 'ExportDataCSV'] });

    if (isGIS) {
      plannedModules.push({ name: 'GIS Mapping Grid', id: 'gis-map', type: 'gis-map', comps: ['GISMapCard', 'MapWidget'] });
    }
    if (isAnalysis) {
      plannedModules.push({ name: 'Analytics', id: 'analysis', type: 'analysis', comps: ['StatsCorrelationCard', 'ANOVAStatsTable'] });
    }

    plannedModules.push({ name: 'Reports Hub', id: 'reports', type: 'report', comps: ['ReportExporterPDF', 'SummaryStatisticsTable'] });
    plannedModules.push({ name: 'System Settings', id: 'settings', type: 'settings', comps: ['ProfileSettings', 'ThemeCustomizer', 'SupabaseSyncStatus'] });

    // 3. Map to Screens and Navigation Items
    for (const m of plannedModules) {
      screens.push({
        id: m.id,
        title: `${m.name} Screen`,
        type: m.type as any,
        components: m.comps
      });

      let icon = 'LayoutDashboard';
      if (m.id === 'data-form') icon = 'PlusCircle';
      else if (m.id === 'data-list') icon = 'Table';
      else if (m.id === 'gis-map') icon = 'Globe';
      else if (m.id === 'analysis') icon = 'BarChart2';
      else if (m.id === 'reports') icon = 'FileText';
      else if (m.id === 'settings') icon = 'Settings';
      else if (m.id === 'login') icon = 'Lock';

      navigationItems.push({
        label: m.name,
        screenId: m.id,
        icon
      });
    }

    return {
      screens,
      navigation: {
        type: 'tabs',
        items: navigationItems
      }
    };
  }
}
