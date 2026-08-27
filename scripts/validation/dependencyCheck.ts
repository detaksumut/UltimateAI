// scripts/validation/dependencyCheck.ts
// This script validates that imports within the Knowledge bounded context
// follow the allowed dependency direction: Ingestion → Registry → Store → Projection → Retrieval.
// It walks the TypeScript AST to collect import statements and checks against a predefined hierarchy.

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface ModuleInfo {
  name: string; // e.g., "ingestion", "registry", etc.
  path: string; // absolute directory path
  level: number; // order in the hierarchy (lower = higher level)
}

// Define the hierarchy levels
const hierarchy: ModuleInfo[] = [
  { name: "ingestion", path: path.resolve("d:/Users/ultimateai/src/production/knowledge/ingestion"), level: 1 },
  { name: "registry", path: path.resolve("d:/Users/ultimateai/src/production/knowledge/registry"), level: 2 },
  { name: "store", path: path.resolve("d:/Users/ultimateai/src/production/knowledge/store"), level: 3 },
  { name: "projection", path: path.resolve("d:/Users/ultimateai/src/production/knowledge/projection"), level: 4 },
  { name: "retrieval", path: path.resolve("d:/Users/ultimateai/src/production/knowledge/retrieval"), level: 5 },
];

function getModuleLevel(importPath: string): number | null {
  const resolved = path.resolve(importPath);
  for (const mod of hierarchy) {
    if (resolved.startsWith(mod.path)) {
      return mod.level;
    }
  }
  return null; // external or unknown module
}

function validateFile(filePath: string): string[] {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ESNext, true);
  const violations: string[] = [];
  const currentModule = hierarchy.find(m => filePath.startsWith(m.path));
  if (!currentModule) return violations; // skip files outside known modules
  const currentLevel = currentModule.level;
  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text;
      // Resolve relative imports to absolute paths
      const importAbs = path.resolve(path.dirname(filePath), importPath);
      const importLevel = getModuleLevel(importAbs);
      if (importLevel !== null && importLevel < currentLevel) {
        violations.push(`${filePath} imports lower‑level module ${importPath}`);
      }
    }
  });
  return violations;
}

function main() {
  const root = path.resolve("d:/Users/ultimateai/src/production/knowledge");
  const files = [] as string[];
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // skip node_modules and test dirs if needed
        if (entry.name === "node_modules") continue;
        walk(fullPath);
      } else if (fullPath.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  walk(root);

  const allViolations: string[] = [];
  for (const file of files) {
    allViolations.push(...validateFile(file));
  }

  if (allViolations.length > 0) {
    console.error("Dependency validation failed:\n" + allViolations.join("\n"));
    process.exit(1);
  } else {
    console.log("Dependency validation passed.");
    process.exit(0);
  }
}

main();
