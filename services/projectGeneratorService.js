// services/projectGeneratorService.js – Generate a React/Vite project structure blueprint from an Application Blueprint

/**
 * Generate a Project Structure Blueprint for a React + Vite application.
 * The function does **not** create any files – it only returns a JSON description
 * of the folder hierarchy, routing, component map, page map and service layer map.
 *
 * @param {Object} appBlueprint - Application Blueprint produced by
 *   applicationBlueprintService.generateApplicationBlueprint.
 *   Expected shape (subset):
 *   {
 *     application: { name: string, description: string },
 *     pages: Array<{ name: string, components?: Array<any> }>,
 *     navigation: Array<{ label: string, route: string }>,
 *     forms: Array<any>,
 *     database: Object,
 *     reports: Array<string>,
 *     deployment: Array<string>
 *   }
 * @returns {Object} Project Structure Blueprint – a plain JSON object describing the
 *   directory layout, routing configuration, component categories, page‑to‑component
 *   mapping and service/hook layers.
 */
function generateProjectStructureBlueprint(appBlueprint) {
  if (!appBlueprint || typeof appBlueprint !== 'object') {
    throw new Error('Invalid Application Blueprint');
  }

  // ---------------------------------------------------------------------
  // 1️⃣ Directory layout (fixed for the React/Vite stack)
  // ---------------------------------------------------------------------
  const directories = [
    'src',
    'src/pages',
    'src/components',
    'src/layouts',
    'src/services',
    'src/hooks',
    'src/lib',
  ];

  // ---------------------------------------------------------------------
  // 2️⃣ Page map – derive file names and routes
  // ---------------------------------------------------------------------
  const defaultPageNames = ['Dashboard', 'DataCollection', 'Reports', 'Settings'];
  const pageEntries = (appBlueprint.pages && appBlueprint.pages.length)
    ? appBlueprint.pages.map(p => ({
        name: p.name || 'Unnamed',
        file: `${p.name.replace(/\s+/g, '')}.jsx`,
        // Use navigation if available; fallback to a kebab‑cased route
        route: (appBlueprint.navigation && appBlueprint.navigation.find(n => n.label === p.name))
                ? appBlueprint.navigation.find(n => n.label === p.name).route
                : `/${p.name.replace(/\s+/g, '-').toLowerCase()}`,
      }))
    : defaultPageNames.map(n => ({
        name: n,
        file: `${n}.jsx`,
        route: `/${n.replace(/\s+/g, '-').toLowerCase()}`,
      }));

  // ---------------------------------------------------------------------
  // 3️⃣ Routing configuration – simple array matching the pages above
  // ---------------------------------------------------------------------
  const routing = pageEntries.map(p => ({ path: p.route, component: p.name }));

  // ---------------------------------------------------------------------
  // 4️⃣ Component map – infer categories from UI blueprint components if present
  // ---------------------------------------------------------------------
  const componentMap = {
    forms: [],
    tables: [],
    charts: [],
    cards: [],
  };

  // Helper to push unique component names
  const addUnique = (arr, name) => { if (name && !arr.includes(name)) arr.push(name); };

  // Scan UI pages for component types (dashboard, data‑collection, reports)
  if (appBlueprint.pages && appBlueprint.pages.length) {
    appBlueprint.pages.forEach(p => {
      const comps = p.components || [];
      comps.forEach(c => {
        switch (c.type) {
          case 'form':
            addUnique(componentMap.forms, `${c.name}Form`);
            break;
          case 'table':
            addUnique(componentMap.tables, `${c.name}Table`);
            break;
          case 'chart':
            addUnique(componentMap.charts, `${c.name}Chart`);
            break;
          case 'kpi-card':
          case 'card':
            addUnique(componentMap.cards, `${c.name.replace(/\s+/g, '')}Card`);
            break;
          default:
            // ignore unknown types for this blueprint
            break;
        }
      });
    });
  }

  // Ensure at least one generic component per category for a minimal scaffold
  if (componentMap.forms.length === 0) addUnique(componentMap.forms, 'GenericForm');
  if (componentMap.tables.length === 0) addUnique(componentMap.tables, 'GenericTable');
  if (componentMap.charts.length === 0) addUnique(componentMap.charts, 'GenericChart');
  if (componentMap.cards.length === 0) addUnique(componentMap.cards, 'KpiCard');

  // ---------------------------------------------------------------------
  // 5️⃣ Service layer map – basic services expected in a research tool
  // ---------------------------------------------------------------------
  const services = [
    'apiService',        // wrappers around fetch / 9Router calls
    'dbService',         // Supabase client abstraction
    'authService',       // optional auth handling
  ];

  // ---------------------------------------------------------------------
  // 6️⃣ Hook map – reusable React hooks
  // ---------------------------------------------------------------------
  const hooks = [
    'useFetch',
    'useForm',
    'useAuth',
  ];

  // ---------------------------------------------------------------------
  // 7️⃣ Library utilities – generic helpers
  // ---------------------------------------------------------------------
  const lib = ['utils'];

  // ---------------------------------------------------------------------
  // Assemble final blueprint
  // ---------------------------------------------------------------------
  return {
    directories,
    pages: pageEntries,
    routing,
    components: componentMap,
    services,
    hooks,
    lib,
  };
}

module.exports = {
  generateProjectStructureBlueprint,
};
