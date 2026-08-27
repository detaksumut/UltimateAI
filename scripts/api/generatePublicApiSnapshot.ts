// scripts/api/generatePublicApiSnapshot.ts
// Generates a deterministic snapshot of all public exports from the Knowledge public API.
// The snapshot records the symbol kind (interface, class, enum, type, function, const, unknown)
// and the name, then computes a SHA‑256 hash of the normalized JSON payload.
// Output conforms to the agreed schema:
// {
//   "schemaVersion": "1.0",
//   "hash": "<sha256>",
//   "symbols": [{ "kind": "interface", "name": "IKnowledgeStore" }, ...]
// }

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Path to the single source‑of‑truth entry point
const INDEX_PATH = path.resolve("src/production/knowledge/index.ts");
// Destination for the snapshot (under docs/api)
const OUT_PATH = path.resolve("docs/api/KnowledgeApiSnapshot.json");

// Helper to map a TypeScript node to a human‑readable kind string
function getKind(node: ts.Node): string | null {
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isVariableStatement(node)) {
    // Only exported const/let/var with a single identifier is considered a "const"
    const decl = node.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) return "const";
  }
  return null;
}

// Parse the index file
const source = fs.readFileSync(INDEX_PATH, "utf8");
const sourceFile = ts.createSourceFile(
  INDEX_PATH,
  source,
  ts.ScriptTarget.ESNext,
  true
);

const symbols: { kind: string; name: string }[] = [];

sourceFile.forEachChild(node => {
  // Exported declarations (class, interface, enum, type, function, const)
  const isExported = (ts.getCombinedModifierFlags(node as any) & ts.ModifierFlags.Export) !== 0;
  if (isExported) {
    const kind = getKind(node);
    const nameNode = (node as any).name;
    if (kind && nameNode && ts.isIdentifier(nameNode)) {
      symbols.push({ kind, name: nameNode.text });
    }
  }
  // Export statements like "export { Foo, Bar }"
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    node.exportClause.elements.forEach(el => {
      // Kind is unknown for re‑exports without type checking
      symbols.push({ kind: "unknown", name: el.name.text });
    });
  }
});

// Sort for determinism: first by kind alphabetically, then by name
symbols.sort((a, b) => {
  if (a.kind < b.kind) return -1;
  if (a.kind > b.kind) return 1;
  return a.name.localeCompare(b.name);
});

// Normalized JSON (no whitespace) for hashing
const jsonPayload = JSON.stringify(symbols);
const hash = crypto.createHash("sha256").update(jsonPayload).digest("hex");

// Write snapshot containing schemaVersion, hash, and symbols array
const outObj = {
  schemaVersion: "1.0",
  hash,
  symbols
};
fs.writeFileSync(OUT_PATH, JSON.stringify(outObj, null, 2));

console.log(`Public API snapshot written to ${OUT_PATH}`);
console.log(`SHA‑256: ${hash}`);
