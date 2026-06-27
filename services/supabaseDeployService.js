// services/supabaseDeployService.js
// Creates a Supabase project and runs the generated SQL schema.

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_ORG_ID       = process.env.SUPABASE_ORG_ID; // optional, uses default org if blank
const SUPABASE_API          = 'https://api.supabase.com';
const SUPABASE_DB_PASSWORD  = process.env.SUPABASE_DB_PASSWORD || 'UltimateAI_2024!';

function sbHeaders() {
  return {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Sanitise a name into a valid Supabase project slug.
 */
function toRef(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);
}

/**
 * Get the first organisation associated with the token.
 */
async function getOrgId() {
  if (SUPABASE_ORG_ID) return SUPABASE_ORG_ID;
  const res = await fetch(`${SUPABASE_API}/v1/organizations`, { headers: sbHeaders() });
  if (!res.ok) throw new Error('Failed to fetch Supabase organizations');
  const orgs = await res.json();
  if (!orgs.length) throw new Error('No Supabase organizations found for this token');
  return orgs[0].id;
}

/**
 * Create a new Supabase project.
 * Supabase projects take 30–90 seconds to provision.
 * @returns {Object} { projectRef, projectUrl, anonKey, dbUrl }
 */
async function createProject(appName) {
  if (!SUPABASE_ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN must be set in .env');
  }

  const orgId = await getOrgId();
  const name  = `${toRef(appName)}-${Date.now().toString(36)}`;

  const res = await fetch(`${SUPABASE_API}/v1/projects`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({
      organization_id: orgId,
      name,
      db_pass: SUPABASE_DB_PASSWORD,
      region: 'ap-southeast-1', // Singapore — closest to Indonesia
      plan: 'free',
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Supabase createProject failed: ${JSON.stringify(err)}`);
  }

  const project = await res.json();

  // Poll until project is ACTIVE_HEALTHY (up to 3 minutes)
  const projectRef = project.id;
  const ready = await waitForProject(projectRef);
  if (!ready) throw new Error(`Supabase project ${projectRef} did not become active in time`);

  // Fetch API keys
  const keysRes = await fetch(`${SUPABASE_API}/v1/projects/${projectRef}/api-keys`, { headers: sbHeaders() });
  const keys    = keysRes.ok ? await keysRes.json() : [];
  const anon    = keys.find(k => k.name === 'anon public') || {};

  return {
    projectRef,
    projectUrl: `https://${projectRef}.supabase.co`,
    anonKey:    anon.api_key || '',
    dbUrl:      `postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`,
  };
}

/**
 * Poll project status until ACTIVE_HEALTHY or timeout.
 */
async function waitForProject(projectRef, maxAttempts = 36, intervalMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await fetch(`${SUPABASE_API}/v1/projects/${projectRef}`, { headers: sbHeaders() });
    if (res.ok) {
      const p = await res.json();
      if (p.status === 'ACTIVE_HEALTHY') return true;
    }
  }
  return false;
}

/**
 * Execute a SQL query against a Supabase project using the Management API.
 * @param {string} projectRef - Supabase project ref
 * @param {string} sql        - SQL DDL to execute
 */
async function runSQL(projectRef, sql) {
  const res = await fetch(`${SUPABASE_API}/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Supabase runSQL failed: ${JSON.stringify(err)}`);
  }
  return await res.json();
}

module.exports = { createProject, runSQL };
