// services/artifactGeneratorService.js – Generate real files and ZIP archive
const fs = require('fs');
const path = require('path');


/**
 * Generate artifact files for a given project.
 * @param {string} projectId - Unique identifier of the project.
 * @param {Object} applicationBlueprint - Blueprint containing application metadata.
 * @param {Object} projectStructure - Blueprint containing src file structure.
 * @returns {Object} { projectId, outputPath, files, zipFile }
 */
function generateArtifacts(projectId, applicationBlueprint, projectStructure) {
  // Base output directory: /generated/{projectId}
  const baseDir = path.resolve(__dirname, '..', 'generated', projectId);
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  // 1. Write README.md
  const readmeContent = `# ${applicationBlueprint?.application?.name || 'GeneratedApp'}\n\n${applicationBlueprint?.application?.description || ''}`;
  const readmePath = path.join(baseDir, 'README.md');
  fs.writeFileSync(readmePath, readmeContent);

  // 2. Write package.json (minimal Vite+React manifest)
  const pkg = {
    name: (applicationBlueprint?.application?.name || 'generated-app').toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      vite: '^5.0.0'
    },
    devDependencies: {
      '@playwright/test': '^1.44.0'
    }
  };
  const pkgPath = path.join(baseDir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  // 3. Write schema.sql – use placeholder tables from projectStructure (if any)
  let schemaSql = '-- Auto‑generated SQL schema\n';
  if (projectStructure?.database?.tables) {
    for (const [tblName, cols] of Object.entries(projectStructure.database.tables)) {
      schemaSql += `CREATE TABLE ${tblName} (\n`;
      const colDefs = [];
      for (const col of cols) {
        colDefs.push(`  ${col.name} ${col.type.toUpperCase()}`);
      }
      schemaSql += colDefs.join(',\n') + '\n);\n\n';
    }
  } else {
    schemaSql += '-- No tables defined in blueprint\n';
  }
  const schemaPath = path.join(baseDir, 'schema.sql');
  fs.writeFileSync(schemaPath, schemaSql);

  // 4. Write src folder – use projectStructure?.src if provided, otherwise minimal entry point
  const srcDir = path.join(baseDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  // main.jsx
  const mainContent = `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<React.StrictMode><App /></React.StrictMode>);`;
  fs.writeFileSync(path.join(srcDir, 'main.jsx'), mainContent);
  // App.jsx – minimal wrapper
  const appContent = `import React from 'react';\nexport default function App() { return <div>Generated Application Placeholder</div>; };`;
  fs.writeFileSync(path.join(srcDir, 'App.jsx'), appContent);

  // 5. Create ZIP archive
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addLocalFolder(baseDir);
  const zipPath = path.join(baseDir, 'project.zip');
  zip.writeZip(zipPath);

  const files = ['README.md', 'package.json', 'schema.sql', 'project.zip'];
  return { projectId, outputPath: baseDir, files, zipFile: zipPath };
}

module.exports = { generateArtifacts };
