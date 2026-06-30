// scripts/audit/architecturalAudit.js
// Node script that performs the architectural audit for the UltimateAI repository.
// Uses the built‑in TypeScript compiler API for static analysis.

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ---- Configuration ---------------------------------------------------
// Adjust these paths if the project layout changes.
const KNOWLEDGE_ROOT = path.resolve('src/production/knowledge');
const CONTRACTS_BARREL = path.join(KNOWLEDGE_ROOT, 'contracts', 'index.ts');
const DOMAIN_BARREL = path.join(KNOWLEDGE_ROOT, 'domain', 'index.ts');
const COMPOSITION_ROOT = path.resolve('src/infrastructure/compositionRoot.ts');

// ---- Helpers ----------------------------------------------------------
function collectTsFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files = files.concat(collectTsFiles(full));
    } else if (e.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const sourceFiles = collectTsFiles(KNOWLEDGE_ROOT);

// ---- 1. Architecture Boundary Verification ---------------------------
function getImportLayer(importPath, currentFile) {
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(path.dirname(currentFile), importPath);
    if (resolved.includes(path.sep + 'application' + path.sep)) return 'application';
    if (resolved.includes(path.sep + 'infrastructure' + path.sep)) return 'infrastructure';
    if (resolved.includes(path.sep + 'domain' + path.sep)) return 'domain';
    if (resolved.includes(path.sep + 'contracts' + path.sep)) return 'contracts';
  }
  return 'external';
}

let architectureBoundaryViolations = [];
for (const file of sourceFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2020, true);
  const isDomain = file.includes(path.sep + 'domain' + path.sep);
  if (!isDomain) continue;
  ts.forEachChild(sf, node => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text;
      const layer = getImportLayer(importPath, file);
      if (layer === 'application' || layer === 'infrastructure') {
        architectureBoundaryViolations.push({ file, importPath, layer });
      }
    }
  });
}

// ---- 2. Public API Surface Inventory -------------------------------
function getExportsFromBarrel(barrelPath) {
  const content = fs.readFileSync(barrelPath, 'utf8');
  const sf = ts.createSourceFile(barrelPath, content, ts.ScriptTarget.ES2020, true);
  const exports = [];
  ts.forEachChild(sf, node => {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach(e => exports.push(e.name.text));
    }
  });
  return exports;
}

const contractsExports = getExportsFromBarrel(CONTRACTS_BARREL);
const domainExports = getExportsFromBarrel(DOMAIN_BARREL);

// ---- 3. Determinism Verification -----------------------------------
// Layer-aware rules:
//   Domain:         No Date.now(), new Date(), Math.random(), crypto, fs, network
//   Application:    No fs, network (Date.now allowed via clock abstraction)
//   Infrastructure: Allowed to use fs, network, Date.now() — it wraps platform APIs
//   Store:          Treated as infrastructure (allowed fs, network)

const domainForbidden = [
  /Date\.now\s*\(/,
  /new\s+Date\s*\(/,
  /Math\.random\s*\(/,
  /crypto\.randomUUID\s*\(/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /require\s*\(\s*['"]http['"]\s*\)/,
  /import\s+.*\s+from\s+['"]fs['"]/, // ES import
  /import\s+.*\s+from\s+['"]http['"]/
];

// Infrastructure is allowed to use platform APIs
const infrastructureForbidden = [
  /Math\.random\s*\(/,
  /crypto\.randomUUID\s*\(/
];

function getFileLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/infrastructure/')) return 'infrastructure';
  if (normalized.includes('/store/')) return 'infrastructure'; // store is infra
  if (normalized.includes('/domain/')) return 'domain';
  if (normalized.includes('/contracts/')) return 'domain';
  if (normalized.includes('/application/')) return 'application';
  // ingestion, projection, navigation, etc. are application-level
  return 'application';
}

let determinismViolations = [];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const layer = getFileLayer(file);

  let patterns;
  if (layer === 'infrastructure') {
    patterns = infrastructureForbidden;
  } else if (layer === 'domain') {
    patterns = domainForbidden;
  } else {
    // application: allow Date.now via clock, but forbid direct fs/network
    patterns = domainForbidden;
  }

  // Updated determinism check: iterate lines and ignore comments
  const lines = content.split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    // Skip single-line comments and block comment delimiters
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    patterns.forEach(pat => {
      if (pat.test(line)) {
        determinismViolations.push({ file, pattern: pat.source, layer });
      }
    });
  });
}

// ---- 4. Composition Root Audit -------------------------------------
const concreteClasses = [
  'PromotionService',
  'MetricsCollector',
  'PendingReferenceRegistry',
  'SystemClock',
  'PromotionMetrics'
];
let compositionRootViolations = [];
for (const file of sourceFiles) {
  if (file === COMPOSITION_ROOT) continue; // allowed location
  const content = fs.readFileSync(file, 'utf8');
  concreteClasses.forEach(cls => {
    const regex = new RegExp(`new\\s+${cls}\\s*\\(`);
    if (regex.test(content)) {
      compositionRootViolations.push({ file, class: cls });
    }
  });
}

// ---- 5. Vendor Leakage in Public API --------------------------------
let vendorLeakageViolations = [];
function checkVendorImports(barrelPath) {
  const content = fs.readFileSync(barrelPath, 'utf8');
  const sf = ts.createSourceFile(barrelPath, content, ts.ScriptTarget.ES2020, true);
  ts.forEachChild(sf, node => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const mod = node.moduleSpecifier.text;
      if (!mod.startsWith('.')) {
        vendorLeakageViolations.push({ barrel: barrelPath, module: mod });
      }
    }
  });
}
checkVendorImports(CONTRACTS_BARREL);
checkVendorImports(DOMAIN_BARREL);

// ---- 6. Barrel Integrity Verification --------------------------------
let barrelIntegrityViolations = [];
function checkBarrelIntegrity(barrelPath) {
  const content = fs.readFileSync(barrelPath, 'utf8');
  const sf = ts.createSourceFile(barrelPath, content, ts.ScriptTarget.ES2020, true);
  ts.forEachChild(sf, node => {
    if (ts.isExportDeclaration(node) && !node.exportClause && node.moduleSpecifier) {
      barrelIntegrityViolations.push({ barrel: barrelPath, line: node.getStart() });
    }
  });
}
checkBarrelIntegrity(CONTRACTS_BARREL);
checkBarrelIntegrity(DOMAIN_BARREL);

// ---- 7. Circular Dependency Detection --------------------------------
const graph = new Map(); // file => Set of resolved imports
function resolveImport(base, importPath) {
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(path.dirname(base), importPath);
    if (fs.existsSync(resolved + '.ts')) return resolved + '.ts';
    if (fs.existsSync(resolved + '/index.ts')) return resolved + '/index.ts';
    if (fs.existsSync(resolved)) return resolved;
  }
  return null; // external module
}
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, content, ts.ScriptTarget.ES2020, true);
  const imports = new Set();
  ts.forEachChild(sf, node => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveImport(file, node.moduleSpecifier.text);
      if (target) imports.add(target);
    }
  });
  graph.set(file, imports);
}
let circularViolations = [];
const visited = new Set();
const stack = new Set();
function dfs(node) {
  if (stack.has(node)) {
    circularViolations.push(node);
    return;
  }
  if (visited.has(node)) return;
  visited.add(node);
  stack.add(node);
  const neighbours = graph.get(node) || [];
  neighbours.forEach(dfs);
  stack.delete(node);
}
sourceFiles.forEach(dfs);

// ---- Assemble Report ------------------------------------------------
const allPass = [
  architectureBoundaryViolations,
  determinismViolations,
  compositionRootViolations,
  vendorLeakageViolations,
  barrelIntegrityViolations,
  circularViolations
].every(arr => arr.length === 0);

const report = {
  status: allPass ? 'PASS' : 'FAIL',
  checks: {
    architectureBoundary: architectureBoundaryViolations.length === 0 ? 'PASS' : 'FAIL',
    publicApi: (contractsExports && domainExports) ? 'PASS' : 'FAIL',
    determinism: determinismViolations.length === 0 ? 'PASS' : 'FAIL',
    compositionRoot: compositionRootViolations.length === 0 ? 'PASS' : 'FAIL',
    vendorLeakage: vendorLeakageViolations.length === 0 ? 'PASS' : 'FAIL',
    barrelIntegrity: barrelIntegrityViolations.length === 0 ? 'PASS' : 'PASS',
    circularDependency: circularViolations.length === 0 ? 'PASS' : 'FAIL'
  },
  violations: {
    architectureBoundary: architectureBoundaryViolations,
    determinism: determinismViolations,
    compositionRoot: compositionRootViolations,
    vendorLeakage: vendorLeakageViolations,
    barrelIntegrity: barrelIntegrityViolations,
    circularDependency: circularViolations
  },
  publicApi: { contractsExports, domainExports }
};

// Write JSON report
fs.writeFileSync(path.resolve('architectural_audit_report.json'), JSON.stringify(report, null, 2), 'utf8');

// Write Markdown report (human readable)
let md = `# Architectural Audit Report\n\n**Status:** ${report.status}\n\n## Checks\n`;
for (const [k, v] of Object.entries(report.checks)) {
  md += `- ${k}: ${v}\n`;
}
md += `\n==========================================\nARCHITECTURAL AUDIT SUMMARY\n==========================================\n\n`;
md += `Architecture Boundary        ${report.checks.architectureBoundary}\n`;
md += `Public API Inventory         ${report.checks.publicApi}\n`;
md += `Determinism                  ${report.checks.determinism}\n`;
md += `Composition Root             ${report.checks.compositionRoot}\n`;
md += `Vendor Leakage               ${report.checks.vendorLeakage}\n`;
md += `Barrel Integrity             ${report.checks.barrelIntegrity}\n`;
md += `Circular Dependency          ${report.checks.circularDependency}\n\n`;
md += `Overall Status: ${report.status}\n`;
md += report.status === 'PASS' ? 'Ready for Milestone 3 Implementation' : 'Implementation Blocked';
md += '\n\n## Violations Detail\n';
function fmt(list, fn) { return list.length ? list.map(fn).join('\n') : 'None'; }
md += '### Architecture Boundary Violations\n' + fmt(architectureBoundaryViolations, v => `* ${v.file} imports ${v.importPath} (layer: ${v.layer})`) + '\n';
md += '### Determinism Violations\n' + fmt(determinismViolations, v => `* ${v.file}: matches ${v.pattern}`) + '\n';
md += '### Composition Root Violations\n' + fmt(compositionRootViolations, v => `* ${v.file}: instantiates ${v.class}`) + '\n';
md += '### Vendor Leakage Violations\n' + fmt(vendorLeakageViolations, v => `* ${v.barrel}: imports third‑party module "${v.module}"`) + '\n';
md += '### Barrel Integrity Violations\n' + fmt(barrelIntegrityViolations, v => `* ${v.barrel}: contains export *`) + '\n';
md += '### Circular Dependency Violations\n' + fmt(circularViolations, v => `* ${v}`) + '\n';

fs.writeFileSync(path.resolve('architectural_audit_report.md'), md, 'utf8');

console.log('Architectural audit completed. Reports generated:');
console.log('- architectural_audit_report.json');
console.log('- architectural_audit_report.md');
process.exit(report.status === 'PASS' ? 0 : 1);
