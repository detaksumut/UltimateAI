// server.js - Minimal Express server for UltimateAI MVP (Phase 1)

require('dotenv').config(); // load .env
const express = require('express');
const cors = require('cors');
// Native fetch used in Node 18+

// Import the AI service that talks to 9Router
const { analyzeResearch } = require('./services/aiService');
const { generateProjectBlueprint } = require('./services/toolBlueprintService');
const { generateDatabaseBlueprint } = require('./services/databaseBlueprintService');
const { generateUIBlueprint } = require('./services/uiBlueprintService');
const { generateApplicationBlueprint } = require('./services/applicationBlueprintService');
const { generateProjectStructureBlueprint } = require('./services/projectGeneratorService');

// Deploy pipeline services
const { createRepo, pushFiles } = require('./services/githubService');
const { createProject: createSupabaseProject, runSQL } = require('./services/supabaseDeployService');
const { createProject: createVercelProject, triggerDeploy, waitForDeployment } = require('./services/vercelDeployService');
const { generateProjectFiles } = require('./services/codeGeneratorService');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Helper Functions ----------
function defaultParameters() {
  // A generic set of research parameters that can be edited by the user.
  return [
    { name: "Subject Name", type: "text", required: true },
    { name: "Measurement (cm)", type: "number", required: true },
    { name: "Date of Observation", type: "date", required: true },
    { name: "Location (GPS)", type: "gps", required: false },
    { name: "Photo", type: "photo", required: false },
  ];
}

// ---------- API Endpoints ----------
// 1. Analyze research description (Research Requirement Engine)
app.post('/api/analyze', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    // Call the 9Router powered AI service
    const analysis = await analyzeResearch(prompt);
    // Ensure we always return the expected top‑level structure
    const structured = {
      researchTitle: analysis.researchTitle || '',
      researchType: analysis.researchType || '',
      researchObjectives: analysis.researchObjectives || [],
      researchQuestions: analysis.researchQuestions || [],
      variables: analysis.variables || { independent: [], dependent: [] },
      methodology: analysis.methodology || '',
      recommendedParameters: analysis.parameters || analysis.recommendedParameters || [],
      recommendedFeatures: analysis.recommendedFeatures || [],
      intent: analysis.intent,
      requirements: analysis.requirements || [],
      entities: analysis.entities || [],
      workflows: analysis.workflows || [],
      roles: analysis.roles || [],
      roleDetails: analysis.roleDetails || [],
      businessRules: analysis.businessRules || [],
      uxStrategy: analysis.uxStrategy || null,
      architectureStrategy: analysis.architectureStrategy || null,
      reports: analysis.reports || [],
      notifications: analysis.notifications || [],
      screens: analysis.screens || [],
      navigation: analysis.navigation,
      theme: analysis.theme,
      analysisMethods: analysis.analysisMethods || [],
      outputs: analysis.outputs || [],
      features: analysis.features || [],
      aiInternalReview: analysis.aiInternalReview || null,
      projectReadiness: analysis.projectReadiness || null,
      domain: analysis.domain || null,
      aiDesignerReasoning: analysis.aiDesignerReasoning
    };
    res.json(structured);
  } catch (err) {
    console.error('AI analysis error:', err);
    // Fallback response when 9Router is unavailable or malformed
    res.status(502).json({
      error: 'AI service unavailable',
      message: err.message,
    });
  }
});

// 2. Recommend default parameters based on analysis (Parameter Builder)
app.post('/api/recommend', (req, res) => {
  // In a full MVP we would tailor this to analysis results.
  const params = defaultParameters();
  res.json({ parameters: params });
});

// ---------- Test Endpoint ----------
// GET /api/test-ai – verifies 9Router connectivity and returns raw details
app.get('/api/test-ai', async (req, res) => {
  const testPrompt = "I want to study the effect of temperature and pH on E.coli growth for 14 days.";
  const requestBody = {
    model: process.env.NINE_ROUTER_MODEL || 'UltimateAI',
    messages: [
      { role: 'system', content: 'You are a research-analysis assistant. Return a JSON object describing the research.' },
      { role: 'user', content: testPrompt }
    ],
    temperature: 0.0,
    max_tokens: 2048,
  };
  try {
    const response = await fetch(`${process.env.NINE_ROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NINE_ROUTER_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
    const rawText = await response.text();
    let parsedResponse;
    try {
      const json = JSON.parse(rawText);
      const content = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;
      parsedResponse = JSON.parse(content);
    } catch (e) {
      parsedResponse = { rawResponse: rawText };
    }
    res.json({
      status: response.ok ? 'connected' : 'error',
      httpStatus: response.status,
      model: requestBody.model,
      requestBody,
      rawResponse: rawText,
      parsedResponse,
    });
  } catch (err) {
    console.error('Test AI endpoint error:', err);
    res.status(502).json({ status: 'error', message: err.message });
  }
});

// 3. Store / retrieve project parameters (Supabase stub – in‑memory for demo)
const projects = {}; // {projectId: {prompt, parameters}}
const generatedApps = {}; // {projectId: { ... }}

// ---------- Test Reset Endpoint ----------
app.post('/api/test/reset', (req, res) => {
  for (const key in projects) delete projects[key];
  for (const key in generatedApps) delete generatedApps[key];
  res.json({ status: 'reset' });
});

// ---------- Artifact Generation Endpoint ----------
const { generateArtifacts } = require('./services/artifactGeneratorService');
app.post('/api/generate-artifacts/:projectId', (req, res) => {
  const { projectId } = req.params;
  const appData = generatedApps[projectId];
  if (!appData) return res.status(404).json({ error: 'Generated app not found' });
  try {
    const result = generateArtifacts(projectId, appData.applicationBlueprint, appData.projectStructure);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate artifacts', message: err.message });
  }
});

// ---------- Download Endpoint ----------
app.get('/api/download/:projectId', (req, res) => {
  const { projectId } = req.params;
  const appData = generatedApps[projectId];
  if (!appData) return res.status(404).json({ error: 'Project not found' });

  try {
    // Generate (or regenerate) artifacts on the fly
    const result = generateArtifacts(projectId, appData.applicationBlueprint, appData.projectStructure);
    const zipPath = result.zipFile;
    const fs = require('fs');
    if (!fs.existsSync(zipPath)) {
      return res.status(500).json({ error: 'ZIP file not found after generation' });
    }

    const appName = (appData.applicationBlueprint?.application?.name || 'research-app')
      .toLowerCase().replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${appName}.zip"`);
    fs.createReadStream(zipPath).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed', message: err.message });
  }
});

app.get('/api/projects', (req, res) => {
  // Return all stored projects as an array
  const list = Object.entries(projects).map(([id, data]) => ({ projectId: id, ...data }));
  res.json(list);
});

app.post('/api/projects', (req, res) => {
  const { spec } = req.body;
  if (!spec) return res.status(400).json({ error: 'Missing research specification' });
  const projectId = crypto.randomUUID();
  // Generate project blueprint immediately for convenience
  const projectBlueprint = generateProjectBlueprint(spec);
  projects[projectId] = { spec, projectBlueprint };
  res.json({ projectId, projectBlueprint });
});

app.get('/api/generated-apps', (req, res) => {
  const list = Object.entries(generatedApps).map(([id, data]) => ({ projectId: id, ...data }));
  res.json(list);
});

app.post('/api/adjust', (req, res) => {
  const { model, adjustmentPrompt } = req.body;
  if (!model || !adjustmentPrompt) {
    return res.status(400).json({ error: 'Model and adjustmentPrompt are required' });
  }

  // Clone and apply adjustment rules
  const updated = JSON.parse(JSON.stringify(model));
  const lower = adjustmentPrompt.toLowerCase();

  if (lower.includes('login') || lower.includes('auth') || lower.includes('signin')) {
    if (!updated.screens.some(s => s.id === 'login')) {
      updated.screens.unshift({
        id: 'login',
        title: 'Login Page',
        type: 'login',
        components: ['LoginFormInput', 'SubmitButton']
      });
    }
  }

  if (lower.includes('color') || lower.includes('theme')) {
    let color = '#3b82f6';
    if (lower.includes('emerald') || lower.includes('green')) color = '#10b981';
    if (lower.includes('violet') || lower.includes('purple')) color = '#8b5cf6';
    if (lower.includes('red') || lower.includes('rose')) color = '#f43f5e';
    updated.theme.primaryColor = color;
  }

  if (lower.includes('add') || lower.includes('tambah')) {
    if (lower.includes('gps') || lower.includes('lokasi')) {
      updated.parameters.push({ name: 'GPS Location', type: 'text', required: false });
    } else if (lower.includes('photo') || lower.includes('foto')) {
      updated.parameters.push({ name: 'Photo Capture', type: 'text', required: false });
    } else if (lower.includes('note') || lower.includes('catatan')) {
      updated.parameters.push({ name: 'Notes', type: 'textarea', required: false });
    }
  }

  res.json({ updatedModel: updated });
});

app.post('/api/approve', (req, res) => {
  const { model } = req.body;
  if (!model) return res.status(400).json({ error: 'Model is required' });
  const updated = { ...model, locked: true };
  res.json({ success: true, model: updated });
});

app.post('/api/generate-tool', async (req, res) => {
  const { researchSpecification } = req.body;
  const requirementModel = req.body.projectModel || req.body.requirementModel;

  // Enforce approval lock if a requirement model is provided
  if (requirementModel && !requirementModel.locked) {
    return res.status(403).json({ error: 'Requirement model must be approved and locked before generating the application.' });
  }

  // Construct specification for downstream generators
  const spec = requirementModel ? {
    researchTitle: requirementModel.researchTitle,
    researchType: requirementModel.researchType,
    methodology: requirementModel.methodology,
    variables: requirementModel.variables,
    researchObjectives: requirementModel.researchObjectives,
    researchQuestions: requirementModel.researchQuestions,
    recommendedFeatures: requirementModel.recommendedFeatures,
    recommendedParameters: requirementModel.parameters
  } : researchSpecification;

  if (!spec) return res.status(400).json({ error: 'Missing researchSpecification or requirementModel' });

  try {
    const projectBlueprint = generateProjectBlueprint(spec);
    const dbBlueprint = generateDatabaseBlueprint(spec, projectBlueprint);
    const uiBlueprint = generateUIBlueprint(spec, projectBlueprint, dbBlueprint);
    const applicationBlueprint = generateApplicationBlueprint(spec, projectBlueprint, dbBlueprint, uiBlueprint);
    const projectStructure = generateProjectStructureBlueprint(applicationBlueprint);
    const projectId = crypto.randomUUID();
    generatedApps[projectId] = {
      researchSpecification: spec,
      applicationBlueprint,
      projectStructure,
      dbBlueprint,
      uiBlueprint,
      deploymentStatus: 'pending',
      liveUrl: null,
      githubUrl: null,
      dbStatus: 'not_deployed',
    };
    res.json({ projectId, applicationBlueprint, projectStructure });
  } catch (err) {
    console.error('Generate tool error:', err);
    res.status(500).json({ error: 'Generation failed', message: err.message });
  }
});

// ── Deploy Pipeline ─────────────────────────────────────────────────────────
// POST /api/deploy/:projectId
// Step 1: GitHub repo + push source code
// Step 2: Supabase project + run SQL schema
// Step 3: Vercel project + deploy + get live URL
app.post('/api/deploy/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const appData = generatedApps[projectId];
  if (!appData) return res.status(404).json({ error: 'Project not found' });

  // Update status to deploying
  appData.deploymentStatus = 'deploying';

  const appName = appData.applicationBlueprint?.application?.name || 'ResearchApp';
  const steps = { github: 'pending', supabase: 'pending', vercel: 'pending' };

  try {
    // ── STEP 1: GitHub ──────────────────────────────────────────────────
    steps.github = 'running';
    console.log(`[Deploy ${projectId}] Creating GitHub repo...`);
    const { repoName, repoUrl } = await createRepo(appName);
    steps.github = 'done';
    appData.githubUrl = repoUrl;

    // Generate source files (without Supabase creds yet — will update after)
    let files = generateProjectFiles(
      appData.applicationBlueprint,
      appData.dbBlueprint,
      appData.researchSpecification,
      '', ''
    );
    console.log(`[Deploy ${projectId}] Pushing ${Object.keys(files).length} files to GitHub...`);
    await pushFiles(repoName, files);

    // ── STEP 2: Supabase ────────────────────────────────────────────────
    steps.supabase = 'running';
    console.log(`[Deploy ${projectId}] Creating Supabase project...`);
    let supabaseUrl = '', supabaseAnonKey = '', supabaseRef = '';
    try {
      const sb = await createSupabaseProject(appName);
      supabaseRef    = sb.projectRef;
      supabaseUrl    = sb.projectUrl;
      supabaseAnonKey = sb.anonKey;
      appData.supabaseRef = supabaseRef;
      appData.dbStatus    = 'connected';
      steps.supabase = 'done';

      // Run schema SQL
      const schemaSql = files['schema.sql'];
      if (schemaSql) {
        console.log(`[Deploy ${projectId}] Running SQL schema...`);
        await runSQL(supabaseRef, schemaSql);
      }

      // Re-push .env with real Supabase credentials
      const envContent = `VITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${supabaseAnonKey}\n`;
      await pushFiles(repoName, { '.env': envContent });
    } catch (sbErr) {
      console.warn(`[Deploy ${projectId}] Supabase step failed (continuing):`, sbErr.message);
      appData.dbStatus = 'not_connected';
      steps.supabase = 'failed';
    }

    // ── STEP 3: Vercel ──────────────────────────────────────────────────
    steps.vercel = 'running';
    console.log(`[Deploy ${projectId}] Creating Vercel project...`);
    const envVars = {};
    if (supabaseUrl)    envVars['VITE_SUPABASE_URL']      = supabaseUrl;
    if (supabaseAnonKey) envVars['VITE_SUPABASE_ANON_KEY'] = supabaseAnonKey;

    const { projectName } = await createVercelProject(repoName, envVars);
    const { deploymentId, deploymentUrl } = await triggerDeploy(projectName, repoName);
    console.log(`[Deploy ${projectId}] Waiting for Vercel deployment ${deploymentId}...`);
    const { status: deployStatus, url: liveUrl } = await waitForDeployment(deploymentId);

    if (deployStatus === 'success') {
      appData.liveUrl = liveUrl;
      appData.deploymentStatus = 'success';
      steps.vercel = 'done';
    } else {
      appData.deploymentStatus = 'failed';
      steps.vercel = 'failed';
    }

    res.json({
      projectId,
      deploymentStatus: appData.deploymentStatus,
      liveUrl:    appData.liveUrl,
      githubUrl:  appData.githubUrl,
      dbStatus:   appData.dbStatus,
      supabaseRef,
      steps,
    });
  } catch (err) {
    console.error(`[Deploy ${projectId}] Fatal error:`, err);
    appData.deploymentStatus = 'failed';
    res.status(500).json({
      error: 'Deployment failed',
      message: err.message,
      steps,
    });
  }
});

// ── Deploy Status ──────────────────────────────────────────────────────────
app.get('/api/deploy/:projectId/status', (req, res) => {
  const app = generatedApps[req.params.projectId];
  if (!app) return res.status(404).json({ error: 'Project not found' });
  res.json({
    deploymentStatus: app.deploymentStatus || 'pending',
    liveUrl:   app.liveUrl   || null,
    githubUrl: app.githubUrl || null,
    dbStatus:  app.dbStatus  || 'not_deployed',
  });
});
// stray code removed

app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  if (!projects[id]) return res.status(404).json({ error: 'Project not found' });
  res.json(projects[id]);
});

// ---------- Server start ----------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 UltimateAI MVP backend listening on http://localhost:${PORT}`);
});
