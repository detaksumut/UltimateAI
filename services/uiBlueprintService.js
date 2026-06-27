// services/uiBlueprintService.js – Generate a UI Blueprint from Research Specification, Project Blueprint, and Database Blueprint

/**
 * Generate a UI Blueprint JSON object.
 *
 * @param {Object} spec - Research Specification (output of analysis).
 * @param {Object} project - Project Blueprint (from toolBlueprintService).
 * @param {Object} dbBlueprint - Database Blueprint (from databaseBlueprintService).
 * @returns {Object} UI Blueprint containing pages, navigation, forms, tables, dashboards, charts, reports, and mobile compatibility flag.
 */
function generateUIBlueprint(spec, project, dbBlueprint) {
  if (!spec || typeof spec !== 'object') throw new Error('Invalid Research Specification');
  if (!project || typeof project !== 'object') throw new Error('Invalid Project Blueprint');
  if (!dbBlueprint || typeof dbBlueprint !== 'object') throw new Error('Invalid Database Blueprint');

  // Helper to create a component placeholder based on type
  const createComponent = (type, name) => ({ type, name });

  // ---------------------------------------------------------------------
  // 1️⃣ Pages – start from project.pages, ensure Dashboard and Data Collection exist.
  // ---------------------------------------------------------------------
  const pages = [];
  const pageNames = Array.isArray(project.pages) && project.pages.length > 0 ? project.pages : ['Dashboard', 'Data Collection', 'Reports'];
  pageNames.forEach(page => {
    const lower = page.toLowerCase();
    let components = [];
    if (lower.includes('dashboard')) {
      // Dashboard components: KPI cards, charts based on numeric parameters, recent observations table.
      const numericParams = (spec.parameters || []).filter(p => p.type === 'number');
      const kpi = numericParams.map(p => createComponent('kpi-card', `${p.name} KPI`));
      const charts = numericParams.map(p => createComponent('chart', `${p.name} Chart`));
      // Add a recent observations table if observations table exists
      const obsTable = Object.keys(dbBlueprint.tables || {}).find(t => t.toLowerCase().includes('observation'));
      if (obsTable) components.push(createComponent('table', `Recent ${obsTable}`));
      components = [...kpi, ...charts, ...components];
    } else if (lower.includes('data') || lower.includes('collection')) {
      // Data Collection page: include forms and possible upload components.
      const formNames = (project.forms || []).map(f => f);
      components = formNames.map(f => createComponent('form', f));
      // If any parameter type is photo, video, audio, add upload components
      const uploadTypes = ['photo', 'video', 'audio', 'pdf'];
      uploadTypes.forEach(t => {
        if ((spec.parameters || []).some(p => p.type === t)) {
          components.push(createComponent('upload', `${t} upload`));
        }
      });
      // GPS capture component if any gps param
      if ((spec.parameters || []).some(p => p.type === 'gps')) {
        components.push(createComponent('gps-capture', 'GPS Capture'));
      }
    } else if (lower.includes('report')) {
      // Reports page: expose export components based on project.reports
      const reportNames = project.reports || ['PDF Report', 'Excel Export'];
      components = reportNames.map(r => createComponent('export', r));
    } else {
      // Generic placeholder page
      components = [createComponent('placeholder', `${page} Content`)]
    }
    pages.push({ name: page, components });
  });

  // ---------------------------------------------------------------------
  // 2️⃣ Navigation Structure – simple ordered list of page names.
  // ---------------------------------------------------------------------
  const navigation = pageNames.map(name => ({ label: name, route: `/${name.toLowerCase().replace(/\s+/g, '-')}` }));

  // ---------------------------------------------------------------------
  // 3️⃣ Forms – detailed list derived from project.forms.
  // ---------------------------------------------------------------------
  const forms = (project.forms || []).map(formName => {
    // Find parameters that belong to this form using a simple heuristic (prefix match)
    const prefix = formName.split(' ')[0].toLowerCase();
    const fields = (spec.parameters || []).filter(p => p.name && p.name.toLowerCase().startsWith(prefix)).map(p => ({
      name: p.name,
      type: p.type,
      required: !!p.required,
    }));
    return { name: formName, fields };
  });

  // ---------------------------------------------------------------------
  // 4️⃣ Tables – expose database tables with a basic column list.
  // ---------------------------------------------------------------------
  const tables = Object.entries(dbBlueprint.tables || {}).map(([tblName, cols]) => ({
    name: tblName,
    columns: cols.map(c => ({ name: c.name, type: c.type, required: !!c.required })),
  }));

  // ---------------------------------------------------------------------
  // 5️⃣ Dashboards – collect pages that contain KPI or chart components.
  // ---------------------------------------------------------------------
  const dashboards = pages
    .filter(p => p.components.some(c => c.type === 'kpi-card' || c.type === 'chart'))
    .map(p => ({ name: p.name, components: p.components.filter(c => c.type === 'kpi-card' || c.type === 'chart') }));

  // ---------------------------------------------------------------------
  // 6️⃣ Charts – aggregate all chart components across pages.
  // ---------------------------------------------------------------------
  const charts = [];
  pages.forEach(p => {
    p.components.forEach(c => {
      if (c.type === 'chart') charts.push({ page: p.name, chart: c.name });
    });
  });

  // ---------------------------------------------------------------------
  // 7️⃣ Reports – list from project.reports.
  // ---------------------------------------------------------------------
  const reports = project.reports || [];

  // ---------------------------------------------------------------------
  // 8️⃣ Mobile Compatibility – flag true (responsive UI is a requirement).
  // ---------------------------------------------------------------------
  const mobileCompatibility = true;

  return {
    pages,
    navigation,
    forms,
    tables,
    dashboards,
    charts,
    reports,
    mobileCompatibility,
  };
}

module.exports = {
  generateUIBlueprint,
};
