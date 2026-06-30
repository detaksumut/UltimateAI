import fs from 'fs';

console.log("=== Architecture Certification (Milestone 1) ===");

const rawData = fs.readFileSync('docs/kernel/v1.0-rc1/dependency-result.json', 'utf8');
const data = JSON.parse(rawData.replace(/^\uFEFF/, ''));

const modules = data.modules;
const violations = data.summary?.violations || [];
let failed = false;

// 1. Check for circular dependencies
const circular = modules.filter((m: any) => m.dependencies.some((d: any) => d.circular));
if (circular.length > 0) {
  console.error("FAIL: Circular dependencies detected!");
  circular.forEach((m: any) => {
    const circDeps = m.dependencies.filter((d: any) => d.circular);
    console.error(`  - ${m.source} has circular deps with: ${circDeps.map((d: any) => d.resolved).join(', ')}`);
  });
  failed = true;
} else {
  console.log("PASS: Zero circular dependencies detected.");
}

// 2. Check boundary violations based on Principles
const errors = [];
for (const m of modules) {
  const source = m.source;
  for (const d of m.dependencies) {
    const target = d.resolved;
    
    // Artifact should not depend on Workflow/Scheduler
    if (source.includes("src/production/artifact") && target.match(/src\/production\/(workflow|scheduler|execution|planning|learning|knowledge|memory)/)) {
      errors.push(`${source} -> ${target} (Violation: Artifact is Foundation Data Layer)`);
    }

    // Knowledge should not depend on Workflow
    if (source.includes("src/production/knowledge") && target.match(/src\/production\/(workflow|scheduler|execution|planning)/)) {
      errors.push(`${source} -> ${target} (Violation: Knowledge is Layer 4, no upward dependencies)`);
    }

    // Memory should not depend on Workflow
    if (source.includes("src/production/memory") && target.match(/src\/production\/(workflow|scheduler|execution|planning)/)) {
      errors.push(`${source} -> ${target} (Violation: Memory is Layer 4, no upward dependencies)`);
    }
  }
}

if (errors.length > 0) {
  console.error("FAIL: Boundary violations detected!");
  errors.forEach(e => console.error("  - " + e));
  failed = true;
} else {
  console.log("PASS: Zero architectural boundary violations.");
}

if (failed) {
  process.exit(1);
} else {
  console.log("Milestone 1 Certification COMPLETE.");
  process.exit(0);
}
