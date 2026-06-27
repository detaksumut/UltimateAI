// services/vercelDeployService.js
// Creates a Vercel project linked to a GitHub repo and deploys it.

const VERCEL_TOKEN   = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || ''; // empty for personal accounts
const VERCEL_API     = 'https://api.vercel.com';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

function vercelHeaders() {
  return {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function teamQuery() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
}

/**
 * Create a Vercel project linked to a GitHub repository.
 * @param {string} repoName   - GitHub repo name (slug)
 * @param {Object} envVars    - Key-value pairs to set as env variables
 * @returns {Object} { projectId, projectName }
 */
async function createProject(repoName, envVars = {}) {
  if (!VERCEL_TOKEN) throw new Error('VERCEL_TOKEN must be set in .env');

  const body = {
    name: repoName,
    framework: 'vite',
    gitRepository: {
      type: 'github',
      repo: `${GITHUB_USERNAME}/${repoName}`,
    },
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
    environmentVariables: Object.entries(envVars).map(([key, value]) => ({
      key, value, type: 'encrypted', target: ['production'],
    })),
  };

  const res = await fetch(`${VERCEL_API}/v9/projects${teamQuery()}`, {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Vercel createProject failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return { projectId: data.id, projectName: data.name };
}

/**
 * Trigger a deployment for a Vercel project from its linked GitHub repo.
 * @param {string} projectName - Vercel project name
 * @param {string} repoName    - GitHub repo name
 * @returns {Object} { deploymentId, deploymentUrl }
 */
async function triggerDeploy(projectName, repoName) {
  const body = {
    name: projectName,
    gitSource: {
      type: 'github',
      repoId: null,   // Vercel resolves by repo name
      ref: 'main',
      repoOwner: GITHUB_USERNAME,
      repoSlug: repoName,
    },
    target: 'production',
  };

  const res = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Vercel triggerDeploy failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    deploymentId: data.id,
    deploymentUrl: `https://${data.url}`,
  };
}

/**
 * Poll a Vercel deployment until it's READY or ERROR.
 * @param {string} deploymentId - Vercel deployment ID
 * @param {number} maxAttempts
 * @param {number} intervalMs
 * @returns {{ status: string, url: string }}
 */
async function waitForDeployment(deploymentId, maxAttempts = 24, intervalMs = 10000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await fetch(
      `${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery()}`,
      { headers: vercelHeaders() }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.readyState === 'READY') return { status: 'success', url: `https://${d.url}` };
      if (d.readyState === 'ERROR') return { status: 'error', url: '' };
    }
  }
  return { status: 'timeout', url: '' };
}

/**
 * Get the production deployment URL for a project by project name.
 */
async function getProductionUrl(projectName) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${projectName}${teamQuery()}`,
    { headers: vercelHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const alias = data.targets?.production?.alias?.[0];
  return alias ? `https://${alias}` : null;
}

module.exports = { createProject, triggerDeploy, waitForDeployment, getProductionUrl };
