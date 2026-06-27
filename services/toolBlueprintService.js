// services/toolBlueprintService.js – Transform a Research Specification into a Project Blueprint

/**
 * Generate a Project Blueprint from a Research Specification.
 *
 * The function extracts the high‑level components needed to scaffold a research‑tool
 * project. It does **not** create any code or external resources – it only returns a
 * plain JavaScript object that downstream generators can consume.
 *
 * @param {Object} spec – Research Specification object returned by the analysis step.
 *   Expected shape (subset):
 *   {
 *     researchTitle: string,
 *     researchType: string,
 *     methodology: string,
 *     variables: { independent: [], dependent: [] },
 *     researchObjectives: [],
 *     researchQuestions: [],
 *     parameters: [],               // array of parameter definitions
 *     recommendedFeatures: []       // optional hints from AI
 *   }
 * @returns {Object} Project Blueprint with the following sections:
 *   - pages: Array<string>
 *   - databaseTables: Array<string>
 *   - forms: Array<string>
 *   - reports: Array<string>
 *   - deploymentTargets: Array<string>
 */
function generateProjectBlueprint(spec) {
  // Defensive check – ensure we have an object.
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid Research Specification provided');
  }

  // 1️⃣ Pages – derived from recommendedFeatures when possible, otherwise fallback.
  const defaultPages = ['Dashboard', 'Data Collection', 'Reports'];
  const pagesFromFeatures = Array.isArray(spec.recommendedFeatures)
    ? spec.recommendedFeatures.filter(f => typeof f === 'string')
    : [];
  const pages = pagesFromFeatures.length > 0 ? pagesFromFeatures : defaultPages;

  // 2️⃣ Database tables – we always need a table for the core observations.
  const baseTables = ['observations', 'measurements', 'attachments'];
  const tables = Array.isArray(spec.recommendedParameters) && spec.recommendedParameters.length > 0
    ? // If parameters include a "name" that suggests a custom entity, add it.
      spec.recommendedParameters.reduce((acc, p) => {
        if (p.name && typeof p.name === 'string') {
          const candidate = p.name.toLowerCase().replace(/\s+/g, '_');
          if (!acc.includes(candidate)) acc.push(candidate);
        }
        return acc;
      }, [...baseTables])
    : [...baseTables];

  // 3️⃣ Forms – one form per custom parameter group (if any), plus a generic observation form.
  const forms = ['Observation Form'];
  if (Array.isArray(spec.recommendedParameters) && spec.recommendedParameters.length > 0) {
    // Detect distinct parameter groups by a simple heuristic: parameters that share a prefix.
    const groups = {};
    spec.recommendedParameters.forEach(p => {
      if (!p.name) return;
      const parts = p.name.split(' ');
      const prefix = parts.length > 1 ? parts[0] : null;
      if (prefix) {
        groups[prefix] = true;
      }
    });
    Object.keys(groups).forEach(g => {
      const formName = `${g.charAt(0).toUpperCase() + g.slice(1)} Form`;
      if (!forms.includes(formName)) forms.push(formName);
    });
  }

  // 4️⃣ Reports – static list for now.
  const reports = ['PDF Report', 'Excel Export'];

  // 5️⃣ Deployment targets – static as per requirement.
  const deploymentTargets = ['GitHub', 'Supabase', 'Vercel'];

  return {
    pages,
    databaseTables: tables,
    forms,
    reports,
    deploymentTargets,
  };
}

module.exports = {
  generateProjectBlueprint,
};
