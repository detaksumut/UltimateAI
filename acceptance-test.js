/**
 * UltimateAI Acceptance Test Script
 * Tests all 17 disciplines end-to-end through the same API the UI calls.
 * No code modifications — read-only verification.
 */

const disciplines = [
  { name: 'Medicine', prompt: 'Investigate the correlation between sleep duration and cardiovascular risk markers (blood pressure, cholesterol, CRP) in adults aged 40-65 over a 12-month longitudinal study' },
  { name: 'Nursing', prompt: 'Evaluate the effectiveness of a nurse-led wound care protocol on healing rates and patient satisfaction in diabetic foot ulcer patients' },
  { name: 'Pharmacy', prompt: 'Analyze the bioavailability and pharmacokinetic profile of a new oral metformin extended-release formulation compared to immediate-release tablets in healthy volunteers' },
  { name: 'Biology', prompt: 'Study the effect of microplastic concentration on freshwater algae photosynthesis rates and cellular morphology across varying pH levels' },
  { name: 'Agriculture', prompt: 'Evaluate the impact of biochar soil amendment on maize yield and soil nutrient retention under tropical dryland conditions' },
  { name: 'Animal Science', prompt: 'Study the effect of probiotic-supplemented feed on broiler chicken growth performance, gut microbiome diversity, and meat quality' },
  { name: 'Education', prompt: 'Compare the effectiveness of gamified e-learning versus traditional lecture-based instruction on student engagement and learning outcomes in high school mathematics' },
  { name: 'Psychology', prompt: 'Investigate the relationship between social media usage patterns and anxiety levels among university students using the GAD-7 scale' },
  { name: 'Law', prompt: 'Analyze the effectiveness of restorative justice programs in reducing juvenile recidivism rates compared to traditional punitive sentencing' },
  { name: 'Public Policy', prompt: 'Evaluate the impact of congestion pricing policies on traffic volume, air quality, and public transit ridership in metropolitan areas' },
  { name: 'Accounting', prompt: 'Examine the relationship between corporate social responsibility disclosure quality and earnings management in publicly listed manufacturing companies' },
  { name: 'Economics', prompt: 'Analyze the causal effect of minimum wage increases on employment levels and small business survival rates in the retail sector' },
  { name: 'Management', prompt: 'Investigate the impact of transformational leadership style on employee innovation behavior mediated by organizational culture in technology startups' },
  { name: 'Civil Engineering', prompt: 'Evaluate the compressive strength and durability of geopolymer concrete using fly ash and rice husk ash as binder replacement materials' },
  { name: 'Computer Science', prompt: 'Develop and evaluate a federated learning approach for medical image classification that preserves patient privacy while maintaining diagnostic accuracy' },
  { name: 'Information Systems', prompt: 'Analyze the factors influencing user adoption of mobile health applications using an extended Technology Acceptance Model (TAM) framework' },
  { name: 'Geography / GIS', prompt: 'Map and analyze urban heat island intensity patterns using Landsat thermal imagery and correlate with green space distribution and building density' },
];

const BASE = 'http://localhost:3001';

async function testDiscipline(d) {
  const result = {
    discipline: d.name,
    prompt: d.prompt,
    status: 'PENDING',
    errors: [],
    analysis: null,
    spec: null,
    generatedApp: null,
    artifacts: null,
    timings: {},
  };

  try {
    // Step 1-2: Analyze
    const t0 = Date.now();
    const analyzeRes = await fetch(`${BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: d.prompt }),
    });
    result.timings.analyze = Date.now() - t0;
    if (!analyzeRes.ok) {
      result.errors.push(`Analyze failed: ${analyzeRes.status}`);
      result.status = 'FAIL';
      return result;
    }
    result.analysis = await analyzeRes.json();

    // Step 3: Build spec from analysis
    const spec = {
      researchTitle: result.analysis.researchTitle || d.prompt.slice(0, 60),
      researchType: result.analysis.researchType || 'Unknown',
      researchObjectives: result.analysis.researchObjectives || [],
      researchQuestions: result.analysis.researchQuestions || [],
      variables: result.analysis.variables || { independent: [], dependent: [] },
      methodology: result.analysis.methodology || '',
      recommendedParameters: result.analysis.recommendedParameters || [],
      recommendedFeatures: result.analysis.recommendedFeatures || [],
    };
    result.spec = spec;

    // Step 4-5: Generate Research Tool
    const t1 = Date.now();
    const genRes = await fetch(`${BASE}/api/generate-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researchSpecification: spec }),
    });
    result.timings.generate = Date.now() - t1;
    if (!genRes.ok) {
      result.errors.push(`Generate failed: ${genRes.status}`);
      result.status = 'FAIL';
      return result;
    }
    const genData = await genRes.json();
    const blueprint = genData.applicationBlueprint || {};
    const dbTablesObj = blueprint.database?.tables || {};
    const dbTableNames = typeof dbTablesObj === 'object' && !Array.isArray(dbTablesObj)
      ? Object.keys(dbTablesObj)
      : Array.isArray(dbTablesObj) ? dbTablesObj.map(t => t.name || JSON.stringify(t)) : [];
    const forms = Array.isArray(blueprint.forms) ? blueprint.forms.map(f => typeof f === 'string' ? f : (f.title || f.name || JSON.stringify(f))) : [];
    const reports = Array.isArray(blueprint.reports) ? blueprint.reports.map(r => typeof r === 'string' ? r : (r.title || r.name || JSON.stringify(r))) : [];
    const pages = Array.isArray(blueprint.pages) ? blueprint.pages.map(pg => typeof pg === 'string' ? pg : (pg.title || pg.name || pg.pageName || JSON.stringify(pg))) : [];
    result.generatedApp = {
      projectId: genData.projectId,
      appName: blueprint.application?.name || 'Unknown',
      appDescription: blueprint.application?.description || '',
      dbTables: dbTableNames,
      forms: forms,
      reports: reports,
      pages: pages,
      projectStructure: genData.projectStructure,
    };

    // Step 6: Generate Artifacts
    const t2 = Date.now();
    const artRes = await fetch(`${BASE}/api/generate-artifacts/${genData.projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    result.timings.artifacts = Date.now() - t2;
    if (!artRes.ok) {
      result.errors.push(`Artifacts failed: ${artRes.status}`);
    } else {
      result.artifacts = await artRes.json();
    }

    result.status = 'PASS';
  } catch (err) {
    result.errors.push(err.message);
    result.status = 'FAIL';
  }
  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  UltimateAI Acceptance Test — 17 Disciplines');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Reset before testing
  await fetch(`${BASE}/api/test/reset`, { method: 'POST' });

  const results = [];
  for (let i = 0; i < disciplines.length; i++) {
    const d = disciplines[i];
    process.stdout.write(`[${i + 1}/17] Testing ${d.name}... `);
    const r = await testDiscipline(d);
    console.log(r.status);
    results.push(r);
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  ACCEPTANCE TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const rows = [];
  for (const r of results) {
    rows.push({
      Discipline: r.discipline,
      Status: r.status,
      'Research Title': r.spec?.researchTitle || '—',
      'App Name': r.generatedApp?.appName || '—',
      'Research Type': r.spec?.researchType || '—',
      'Methodology': r.spec?.methodology || '—',
      '# Params': (r.spec?.recommendedParameters || []).length,
      '# DB Tables': (r.generatedApp?.dbTables || []).length,
      '# Forms': (r.generatedApp?.forms || []).length,
      '# Reports': (r.generatedApp?.reports || []).length,
      '# Files': (r.artifacts?.files || []).length,
      'Analyze ms': r.timings.analyze || '—',
      'Generate ms': r.timings.generate || '—',
      Errors: r.errors.length ? r.errors.join('; ') : 'None',
    });
  }
  console.table(rows);

  // ── Detailed per-discipline output ──────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  DETAILED DISCIPLINE RESULTS');
  console.log('═══════════════════════════════════════════════════════════');

  for (const r of results) {
    console.log(`\n──── ${r.discipline} ────────────────────────────────`);
    console.log(`Status:          ${r.status}`);
    console.log(`Research Title:  ${r.spec?.researchTitle}`);
    console.log(`Research Type:   ${r.spec?.researchType}`);
    console.log(`Methodology:     ${r.spec?.methodology}`);
    console.log(`App Name:        ${r.generatedApp?.appName}`);
    console.log(`Parameters:      ${(r.spec?.recommendedParameters || []).map(p => p.name || p).join(', ')}`);
    console.log(`DB Tables:       ${(r.generatedApp?.dbTables || []).join(', ')}`);
    console.log(`Forms:           ${(r.generatedApp?.forms || []).join(', ')}`);
    console.log(`Reports:         ${(r.generatedApp?.reports || []).join(', ')}`);
    console.log(`Artifact Files:  ${(r.artifacts?.files || []).join(', ')}`);
    console.log(`Timings:         Analyze=${r.timings.analyze}ms  Generate=${r.timings.generate}ms  Artifacts=${r.timings.artifacts}ms`);
    if (r.errors.length) console.log(`Errors:          ${r.errors.join('; ')}`);
  }

  // ── Uniqueness Check ────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  UNIQUENESS VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const appNames = results.map(r => r.generatedApp?.appName).filter(Boolean);
  const uniqueAppNames = new Set(appNames);
  console.log(`App Names: ${appNames.length} total, ${uniqueAppNames.size} unique`);
  if (uniqueAppNames.size < appNames.length) {
    console.log('⚠ DUPLICATE APP NAMES FOUND:');
    const counts = {};
    appNames.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    Object.entries(counts).filter(([, c]) => c > 1).forEach(([n, c]) => console.log(`  "${n}" appears ${c} times`));
  }

  const researchTypes = results.map(r => r.spec?.researchType).filter(Boolean);
  const uniqueTypes = new Set(researchTypes);
  console.log(`Research Types: ${researchTypes.length} total, ${uniqueTypes.size} unique`);

  const methodologies = results.map(r => r.spec?.methodology).filter(Boolean);
  const uniqueMethodologies = new Set(methodologies);
  console.log(`Methodologies: ${methodologies.length} total, ${uniqueMethodologies.size} unique`);

  // Check for identical DB table sets
  const dbTableSets = results.map(r => JSON.stringify((r.generatedApp?.dbTables || []).sort()));
  const uniqueDbSets = new Set(dbTableSets);
  console.log(`DB Table Sets: ${dbTableSets.length} total, ${uniqueDbSets.size} unique`);

  // ── Overall Verdict ─────────────────────────────────────────────
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const overall = failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n\n══════════════════════════════════════════`);
  console.log(`  OVERALL: ${overall}  (${passed} passed, ${failed} failed)`);
  console.log(`══════════════════════════════════════════\n`);

  // Write JSON results
  const fs = require('fs');
  fs.writeFileSync('acceptance-test-results.json', JSON.stringify(results, null, 2));
  console.log('Full results saved to acceptance-test-results.json');
}

main().catch(console.error);
