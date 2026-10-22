/**
 * TestOrchestrator.mjs
 * Real verification pipeline for a repair candidate in an isolated worktree.
 * Missing build scripts, missing tests, syntax errors, and timeouts are failures,
 * never silent passes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_CHARS = 12000;
const MAX_TEST_TIMEOUT_MS = 45000;
const BUILD_TIMEOUT_MS = 180000;

function normalized(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function cleanTestEnvironment() {
  const allow = [
    'PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP',
    'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'COMSPEC', 'ComSpec',
    'PATHEXT', 'PROGRAMFILES', 'ProgramFiles', 'PROGRAMFILES(X86)',
    'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS'
  ];
  const env = {};
  for (const key of allow) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  env.NODE_ENV = 'test';
  env.CI = '1';
  return env;
}

export class TestOrchestrator {
  constructor(workspaceRoot = process.cwd(), options = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.timeoutMs = Number(options.timeoutMs) || MAX_TEST_TIMEOUT_MS;
  }

  _resolveRelative(filePath) {
    const relative = normalized(filePath);
    if (!relative || path.posix.isAbsolute(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('TEST_PATH_INVALID: expected normalized relative path.');
    }
    const absolute = path.resolve(this.workspaceRoot, ...relative.split('/'));
    if (!isInside(this.workspaceRoot, absolute)) throw new Error('TEST_PATH_INVALID: path escaped worktree.');
    return { relative, absolute };
  }

  async _runNode(args, timeout = this.timeoutMs) {
    return execFileAsync(process.execPath, args, {
      cwd: this.workspaceRoot,
      timeout,
      maxBuffer: 3 * 1024 * 1024,
      windowsHide: true,
      env: cleanTestEnvironment()
    });
  }

  async runSyntaxValidation(filePaths = []) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = [];
    if (!paths.length) return { stage: 'SYNTAX_CHECK', pass: false, error: 'No changed files were supplied.' };

    for (const filePath of paths) {
      let resolved;
      try {
        resolved = this._resolveRelative(filePath);
        if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) {
          results.push({ file: resolved.relative, pass: false, error: 'Changed file does not exist in the sandbox.' });
          continue;
        }
        const code = fs.readFileSync(resolved.absolute, 'utf8');
        if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(code)) {
          results.push({ file: resolved.relative, pass: false, error: 'Merge conflict markers detected.' });
          continue;
        }
        if (['.mjs', '.js', '.cjs'].includes(path.extname(resolved.absolute).toLowerCase())) {
          try {
            const { stdout, stderr } = await this._runNode(['--check', resolved.absolute], 20000);
            results.push({ file: resolved.relative, pass: true, output: (stdout + stderr).slice(-MAX_OUTPUT_CHARS) });
          } catch (err) {
            results.push({ file: resolved.relative, pass: false, error: String(err.message || err).slice(-MAX_OUTPUT_CHARS) });
          }
        } else {
          // TypeScript/JSX syntax is validated by the real project build below.
          results.push({ file: resolved.relative, pass: true, delegatedToBuild: true });
        }
      } catch (err) {
        results.push({ file: String(filePath), pass: false, error: err.message });
      }
    }
    return {
      stage: 'SYNTAX_CHECK',
      pass: results.length > 0 && results.every((item) => item.pass),
      results
    };
  }

  async runBuildValidation() {
    const packagePath = path.join(this.workspaceRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return { stage: 'BUILD_VERIFY', pass: false, error: 'package.json was not found in the repair worktree.' };
    }

    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')); } catch (err) {
      return { stage: 'BUILD_VERIFY', pass: false, error: 'package.json is invalid JSON: ' + err.message };
    }
    if (!pkg.scripts || typeof pkg.scripts.build !== 'string' || !pkg.scripts.build.trim()) {
      return { stage: 'BUILD_VERIFY', pass: false, error: 'No real build script is configured; cannot certify this repair.' };
    }

    try {
      let result;
      if (process.platform === 'win32' && process.env.npm_execpath) {
        result = await execFileAsync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
          cwd: this.workspaceRoot, timeout: BUILD_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024,
          windowsHide: true, env: cleanTestEnvironment()
        });
      } else if (process.platform === 'win32') {
        // Fixed command only; no incident data or model output is interpolated.
        result = await execFileAsync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
          cwd: this.workspaceRoot, timeout: BUILD_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024,
          windowsHide: true, env: cleanTestEnvironment()
        });
      } else {
        result = await execFileAsync('npm', ['run', 'build'], {
          cwd: this.workspaceRoot, timeout: BUILD_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024,
          windowsHide: true, env: cleanTestEnvironment()
        });
      }
      const output = (String(result.stdout || '') + '\n' + String(result.stderr || '')).slice(-MAX_OUTPUT_CHARS);
      return { stage: 'BUILD_VERIFY', pass: true, command: 'npm run build', output };
    } catch (err) {
      return {
        stage: 'BUILD_VERIFY',
        pass: false,
        command: 'npm run build',
        timedOut: Boolean(err.killed || err.code === 'ETIMEDOUT'),
        error: String(err.message || err).slice(-MAX_OUTPUT_CHARS),
        output: (String(err.stdout || '') + '\n' + String(err.stderr || '')).slice(-MAX_OUTPUT_CHARS)
      };
    }
  }

  async runRegressionTests(testFiles = []) {
    const results = [];
    if (!Array.isArray(testFiles) || testFiles.length === 0) {
      return { stage: 'REGRESSION_TESTS', pass: false, error: 'No regression test was generated or selected.' };
    }

    for (const filePath of testFiles) {
      let resolved;
      try {
        resolved = this._resolveRelative(filePath);
        if (!resolved.relative.startsWith('tests/engineering/repair-generated/')) {
          results.push({ file: resolved.relative, pass: false, error: 'Automatic repair may only execute generated tests in the dedicated test directory.' });
          continue;
        }
        if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) {
          results.push({ file: resolved.relative, pass: false, error: 'Regression test file is missing.' });
          continue;
        }
        const testSource = fs.readFileSync(resolved.absolute, 'utf8');
        if (Buffer.byteLength(testSource, 'utf8') > 24 * 1024) {
          results.push({ file: resolved.relative, pass: false, error: 'Regression test exceeds 24 KB.' });
          continue;
        }
        try {
          // Some repair targets are TypeScript modules. Use the repo's existing
          // tsx loader only when the generated regression test imports .ts code.
          const usesTypeScript = /\\.tsx?['"]/i.test(testSource);
          const nodeArgs = usesTypeScript ? ['--import', 'tsx', resolved.absolute] : [resolved.absolute];
          const { stdout, stderr } = await this._runNode(nodeArgs, this.timeoutMs);
          results.push({
            file: resolved.relative,
            pass: true,
            output: (String(stdout || '') + '\n' + String(stderr || '')).slice(-MAX_OUTPUT_CHARS)
          });
        } catch (err) {
          results.push({
            file: resolved.relative,
            pass: false,
            timedOut: Boolean(err.killed || err.code === 'ETIMEDOUT'),
            error: String(err.message || err).slice(-MAX_OUTPUT_CHARS),
            output: (String(err.stdout || '') + '\n' + String(err.stderr || '')).slice(-MAX_OUTPUT_CHARS)
          });
        }
      } catch (err) {
        results.push({ file: String(filePath), pass: false, error: err.message });
      }
    }
    return {
      stage: 'REGRESSION_TESTS',
      pass: results.length > 0 && results.every((item) => item.pass),
      results
    };
  }

  async runFullVerificationPipeline(input, legacyTestScript = null) {
    const options = typeof input === 'string'
      ? { changedFiles: [input], testFiles: legacyTestScript ? [legacyTestScript] : [] }
      : (input || {});
    const changedFiles = Array.isArray(options.changedFiles) ? options.changedFiles : [];
    const testFiles = Array.isArray(options.testFiles) ? options.testFiles : [];
    const results = [];

    const syntax = await this.runSyntaxValidation(changedFiles);
    results.push(syntax);
    if (!syntax.pass) return { pass: false, results, failedStage: syntax.stage, error: 'Syntax validation failed.' };

    const regression = await this.runRegressionTests(testFiles);
    results.push(regression);
    if (!regression.pass) return { pass: false, results, failedStage: regression.stage, error: regression.error || 'Regression tests failed.' };

    const build = await this.runBuildValidation();
    results.push(build);
    if (!build.pass) return { pass: false, results, failedStage: build.stage, error: build.error || 'Project build failed.' };

    return {
      pass: true,
      results,
      summary: 'All configured stages passed: syntax, targeted regression tests, and project build.',
      verifiedAt: new Date().toISOString(),
      workspaceRoot: this.workspaceRoot
    };
  }
}

export const testOrchestratorInstance = new TestOrchestrator();
