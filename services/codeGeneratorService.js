// services/codeGeneratorService.js
// Generates actual source code files for the research application.

/**
 * Build a complete set of source files for the research app.
 * Returns an object: { 'path/file': 'content' }
 */
function generateProjectFiles(appBlueprint, dbBlueprint, researchSpec, supabaseUrl, supabaseAnonKey) {
  const appName  = appBlueprint?.application?.name || 'ResearchApp';
  const appSlug  = appName.toLowerCase().replace(/\s+/g, '-');
  const tables   = dbBlueprint?.tables || [];
  const pages    = appBlueprint?.pages || [];

  // ── package.json ───────────────────────────────────────────────────────
  const packageJson = JSON.stringify({
    name: appSlug,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@supabase/supabase-js': '^2.43.4',
      'react-hot-toast': '^2.4.1',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.1',
      vite: '^5.3.1',
    },
  }, null, 2);

  // ── vite.config.js ─────────────────────────────────────────────────────
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
`;

  // ── index.html ─────────────────────────────────────────────────────────
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1e40af" />
    <meta name="description" content="${appBlueprint?.application?.description || appName}" />
    <link rel="manifest" href="/manifest.json" />
    <title>${appName}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #f1f5f9; color: #1e293b; min-height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

  // ── manifest.json (PWA — Add to Home Screen) ───────────────────────────
  const manifest = JSON.stringify({
    name: appName,
    short_name: appName.split(' ').map(w => w[0]).join('').toUpperCase(),
    start_url: '/',
    display: 'standalone',
    background_color: '#1e40af',
    theme_color: '#1e40af',
    description: appBlueprint?.application?.description || '',
    icons: [
      { src: 'https://ui-avatars.com/api/?name=R&background=1e40af&color=fff&size=192', sizes: '192x192', type: 'image/png' },
      { src: 'https://ui-avatars.com/api/?name=R&background=1e40af&color=fff&size=512', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2);

  // ── .env.example ───────────────────────────────────────────────────────
  const envExample = `VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
`;

  // ── .env (with real values, Vercel will use env vars) ──────────────────
  const envFile = `VITE_SUPABASE_URL=${supabaseUrl || 'https://placeholder.supabase.co'}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey || 'placeholder_key'}
`;

  // ── src/main.jsx ────────────────────────────────────────────────────────
  const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" />
  </React.StrictMode>
)
`;

  // ── src/lib/supabase.js ─────────────────────────────────────────────────
  const supabaseLib = `import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')
`;

  // ── Build data entry form fields from researchSpec parameters ───────────
  const params   = researchSpec?.parameters || [];
  const firstTable = tables[0]?.name || 'research_data';

  const formFields = params.map(p => {
    const id = p.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (p.type === 'dropdown' && p.options?.length) {
      return `      <div style={styles.field}>
        <label style={styles.label}>${p.name}${p.required ? ' *' : ''}</label>
        <select name="${id}" style={styles.input} required={${!!p.required}}>
          <option value="">-- Select --</option>
          ${(p.options || []).map(o => `<option value="${o}">${o}</option>`).join('\n          ')}
        </select>
      </div>`;
    }
    if (p.type === 'textarea') {
      return `      <div style={styles.field}>
        <label style={styles.label}>${p.name}${p.required ? ' *' : ''}</label>
        <textarea name="${id}" rows={3} style={{...styles.input, resize:'vertical'}} required={${!!p.required}} />
      </div>`;
    }
    const htmlType = p.type === 'number' ? 'number' : p.type === 'date' ? 'date' :
                     p.type === 'email' ? 'email' : p.type === 'phone' ? 'tel' :
                     p.type === 'url' ? 'url' : 'text';
    return `      <div style={styles.field}>
        <label style={styles.label}>${p.name}${p.required ? ' *' : ''}</label>
        <input type="${htmlType}" name="${id}" style={styles.input} required={${!!p.required}} />
      </div>`;
  }).join('\n');

  // ── src/App.jsx ─────────────────────────────────────────────────────────
  const appJsx = `import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import toast from 'react-hot-toast'

const TABLE = '${firstTable}'

const styles = {
  app: { minHeight: '100vh', background: '#f1f5f9', padding: '0' },
  header: { background: '#1e40af', color: '#fff', padding: '1rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  subtitle: { fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' },
  main: { maxWidth: '720px', margin: '2rem auto', padding: '0 1rem' },
  card: { background: '#fff', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  h2: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 600,
           color: '#475569', marginBottom: '4px' },
  input: { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1',
           borderRadius: '8px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' },
  btn: { background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px',
         padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 600,
         cursor: 'pointer', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', padding: '0.6rem', background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600 },
  td: { padding: '0.6rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  badge: { display: 'inline-block', background: '#dcfce7', color: '#166534',
           padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 },
  emptyMsg: { textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' },
}

export default function App() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('form') // 'form' | 'data'

  const fetchRecords = async () => {
    const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false }).limit(100)
    if (!error) setRecords(data || [])
  }

  useEffect(() => { fetchRecords() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    const row = Object.fromEntries(formData.entries())
    const { error } = await supabase.from(TABLE).insert([row])
    setLoading(false)
    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success('Data saved successfully!')
      e.target.reset()
      fetchRecords()
    }
  }

  const columns = records.length > 0
    ? Object.keys(records[0]).filter(k => k !== 'id')
    : ${JSON.stringify(params.map(p => p.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')))}

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.title}>${appName}</div>
          <div style={styles.subtitle}>Research Data Collection — Powered by UltimateAI</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {['form','data'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab===t ? '#fff' : 'rgba(255,255,255,0.15)',
                       color: tab===t ? '#1e40af' : '#fff', border:'none',
                       borderRadius:'6px', padding:'0.4rem 0.9rem',
                       fontWeight:600, cursor:'pointer', fontSize:'0.85rem' }}>
              {t === 'form' ? '✏️ Enter Data' : '📊 View Data'}
            </button>
          ))}
        </div>
      </header>

      <main style={styles.main}>
        {tab === 'form' && (
          <div style={styles.card}>
            <h2 style={styles.h2}>Data Entry Form</h2>
            <form onSubmit={handleSubmit}>
${formFields || `              <div style={styles.field}>
                <label style={styles.label}>Note</label>
                <input type="text" name="note" style={styles.input} />
              </div>`}
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Saving...' : '💾 Save Data'}
              </button>
            </form>
          </div>
        )}

        {tab === 'data' && (
          <div style={styles.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{...styles.h2, margin:0}}>Collected Data</h2>
              <span style={styles.badge}>{records.length} records</span>
            </div>
            {records.length === 0 ? (
              <p style={styles.emptyMsg}>No data yet. Enter your first record!</p>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {columns.map(c => <th key={c} style={styles.th}>{c.replace(/_/g,' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i}>
                        {columns.map(c => <td key={c} style={styles.td}>{String(r[c] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
`;

  // ── schema.sql ──────────────────────────────────────────────────────────
  const paramCols = params.map(p => {
    const col = p.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const pgType = p.type === 'number' ? 'NUMERIC' : p.type === 'date' ? 'DATE' : 'TEXT';
    return `  ${col} ${pgType}${p.required ? ' NOT NULL' : ''}`;
  }).join(',\n');

  const schemaSql = `-- Auto-generated by UltimateAI
-- Application: ${appName}

CREATE TABLE IF NOT EXISTS ${firstTable} (
  id   BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()${paramCols ? ',\n' + paramCols : ''}
);

-- Enable Row Level Security (RLS)
ALTER TABLE ${firstTable} ENABLE ROW LEVEL SECURITY;

-- Allow anonymous insert (for research data collection)
CREATE POLICY "Allow anonymous insert" ON ${firstTable}
  FOR INSERT WITH CHECK (true);

-- Allow anonymous select
CREATE POLICY "Allow anonymous select" ON ${firstTable}
  FOR SELECT USING (true);
`;

  // ── README.md ───────────────────────────────────────────────────────────
  const readme = `# ${appName}

> Generated by **UltimateAI** — Helping Researchers Build, Not Code.

## About
${appBlueprint?.application?.description || researchSpec?.researchTitle || appName}

## Research Type
${researchSpec?.researchType || 'General Research'}

## Features
- ✅ Data Entry Form
- ✅ Live Data Table
- ✅ Supabase Database
- ✅ PWA — Installable to mobile phone

## Setup
1. Copy \`.env.example\` to \`.env\`
2. Fill in your Supabase URL and Anon Key
3. Run \`npm install && npm run dev\`

---
*Generated by UltimateAI on ${new Date().toLocaleDateString()}*
`;

  return {
    'README.md': readme,
    'package.json': packageJson,
    'vite.config.js': viteConfig,
    'index.html': indexHtml,
    'public/manifest.json': manifest,
    '.env.example': envExample,
    '.env': envFile,
    'src/main.jsx': mainJsx,
    'src/lib/supabase.js': supabaseLib,
    'src/App.jsx': appJsx,
    'schema.sql': schemaSql,
  };
}

module.exports = { generateProjectFiles };
