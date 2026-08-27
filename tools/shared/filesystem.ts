// tools/shared/filesystem.ts
import * as fs from 'fs';
import * as path from 'path';

/** Check if a path exists */
export function exists(p: string): boolean {
  return fs.existsSync(p);
}

/** Ensure a directory exists (create recursively if needed) */
export function ensureDirectory(p: string): void {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

/** Read a JSON file and parse its contents */
export function readJson<T>(p: string): T {
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Write an object as pretty‑printed JSON */
export function writeJson(p: string, obj: any, indent = 2): void {
  ensureDirectory(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, indent) + '\n', 'utf-8');
}

/** List files in a directory (non‑recursive) */
export function listFiles(p: string): string[] {
  if (!fs.existsSync(p) || !fs.lstatSync(p).isDirectory()) {
    return [];
  }
  return fs.readdirSync(p);
}
